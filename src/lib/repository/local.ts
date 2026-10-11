// 로컬 JSON 어댑터 (기본 저장소). DB 없이 동작한다.
// - 읽기 전용 시드 data/rules.seed.json 을 첫 실행 시 data/rules.local.json 으로 복사해 쓴다.
// - 쓰기는 임시 파일 작성 후 rename 으로 교체(원자적)하고, 프로세스 내에서 직렬화한다.
// - 파일이 손상되었으면 덮어쓰지 않고 StorageUnavailableError 를 던진다.

import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import {
  DuplicateRuleError,
  NotFoundError,
  StorageUnavailableError,
  ValidationError,
} from "../rules/errors";
import { applyRuleFilter, sortRules } from "../rules/filter";
import {
  RULE_STATUSES,
  RULE_TYPES,
  ruleKey,
  type Rule,
  type RuleFilter,
  type RuleInput,
  type RuleStatus,
} from "../rules/types";
import { validateDeletion, validateRuleInput, validateStatusUpdate } from "../rules/validate";
import type { Repository } from "./types";

const LOCAL_FILE = "rules.local.json";
const SEED_FILE = "rules.seed.json";

export interface LocalRepositoryOptions {
  dataDir?: string;
  seedPath?: string;
}

// Next 개발 서버는 라우트별로 모듈을 다시 로드할 수 있으므로 직렬화 큐는 globalThis 에 둔다.
const g = globalThis as unknown as { __cvdLocalQueues?: Map<string, Promise<unknown>> };
function queues(): Map<string, Promise<unknown>> {
  if (!g.__cvdLocalQueues) g.__cvdLocalQueues = new Map();
  return g.__cvdLocalQueues;
}

function emptyToNull(v: unknown): string | null {
  if (typeof v !== "string") return null;
  return v === "" ? null : v;
}

function toRule(raw: unknown, where: string): Rule {
  if (typeof raw !== "object" || raw === null) {
    throw new StorageUnavailableError(`규칙 파일 형식이 올바르지 않습니다: ${where}`);
  }
  const r = raw as Record<string, unknown>;
  const ok =
    typeof r.id === "string" &&
    typeof r.nexaFn === "string" &&
    typeof r.source === "string" &&
    typeof r.author === "string" &&
    typeof r.createdAt === "string" &&
    typeof r.updatedAt === "string" &&
    (RULE_TYPES as readonly string[]).includes(r.ruleType as string) &&
    (RULE_STATUSES as readonly string[]).includes(r.status as string);
  if (!ok) {
    throw new StorageUnavailableError(`규칙 파일 형식이 올바르지 않습니다: ${where}`);
  }
  return {
    id: r.id as string,
    nexaFn: r.nexaFn as string,
    wsFn: emptyToNull(r.wsFn),
    ruleType: r.ruleType as Rule["ruleType"],
    targetType: emptyToNull(r.targetType),
    intentNote: emptyToNull(r.intentNote),
    exampleBefore: emptyToNull(r.exampleBefore),
    exampleAfter: emptyToNull(r.exampleAfter),
    source: r.source as string,
    status: r.status as RuleStatus,
    author: r.author as string,
    verifiedBy: emptyToNull(r.verifiedBy),
    createdAt: r.createdAt as string,
    updatedAt: r.updatedAt as string,
    // 삭제 기능 이전에 만들어진 파일에는 이 두 필드가 없다 → null(삭제 안 됨)
    deletedAt: emptyToNull(r.deletedAt),
    deleteReason: emptyToNull(r.deleteReason),
  };
}

function parseRulesFile(text: string, where: string): Rule[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new StorageUnavailableError(
      `규칙 파일이 손상되었습니다(JSON 해석 실패): ${where}. 파일을 확인하거나 삭제한 뒤 다시 실행하세요. (자동으로 덮어쓰지 않습니다)`,
    );
  }
  const list = Array.isArray(parsed)
    ? parsed
    : typeof parsed === "object" && parsed !== null && Array.isArray((parsed as { rules?: unknown }).rules)
      ? (parsed as { rules: unknown[] }).rules
      : null;
  if (!list) {
    throw new StorageUnavailableError(`규칙 파일 형식이 올바르지 않습니다: ${where}`);
  }
  return list.map((x) => toRule(x, where));
}

export class LocalRepository implements Repository {
  readonly kind = "local" as const;
  private readonly filePath: string;
  private readonly seedPath: string;

  constructor(opts: LocalRepositoryOptions = {}) {
    const dataDir =
      opts.dataDir ?? process.env.CVD_DATA_DIR?.trim() ?? path.join(process.cwd(), "data");
    this.filePath = path.join(dataDir || path.join(process.cwd(), "data"), LOCAL_FILE);
    this.seedPath = opts.seedPath ?? path.join(process.cwd(), "data", SEED_FILE);
  }

  /** 같은 파일에 대한 작업을 한 줄로 세운다(읽기-수정-쓰기 경합 방지). */
  private serialize<T>(task: () => Promise<T>): Promise<T> {
    const q = queues();
    const prev = q.get(this.filePath) ?? Promise.resolve();
    const run = prev.then(task, task);
    q.set(
      this.filePath,
      run.catch(() => undefined),
    );
    return run;
  }

  private async readAll(): Promise<Rule[]> {
    let text: string;
    try {
      text = await fs.readFile(this.filePath, "utf8");
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "ENOENT") {
        throw new StorageUnavailableError(`로컬 규칙 파일을 읽을 수 없습니다: ${this.filePath}`);
      }
      return this.initFromSeed();
    }
    return parseRulesFile(text, this.filePath);
  }

  private async initFromSeed(): Promise<Rule[]> {
    let seedText: string;
    try {
      seedText = await fs.readFile(this.seedPath, "utf8");
    } catch {
      throw new StorageUnavailableError(
        `시드 파일을 읽을 수 없습니다: ${this.seedPath}. data/rules.seed.json 이 있는지 확인하세요.`,
      );
    }
    const rules = parseRulesFile(seedText, this.seedPath);
    await this.writeAll(rules);
    return rules;
  }

  private async writeAll(rules: Rule[]): Promise<void> {
    const dir = path.dirname(this.filePath);
    const tmp = `${this.filePath}.${process.pid}.${randomUUID().slice(0, 8)}.tmp`;
    const body = JSON.stringify({ version: 1, rules }, null, 2) + "\n";
    try {
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(tmp, body, "utf8");
      let lastErr: unknown;
      for (let attempt = 0; attempt < 5; attempt++) {
        try {
          await fs.rename(tmp, this.filePath);
          return;
        } catch (e) {
          lastErr = e;
          // Windows 에서 백신 등이 잠시 파일을 잡고 있으면 EPERM/EBUSY 가 날 수 있다.
          const code = (e as NodeJS.ErrnoException).code;
          if (code !== "EPERM" && code !== "EBUSY" && code !== "EACCES") break;
          await new Promise((r) => setTimeout(r, 30 * (attempt + 1)));
        }
      }
      throw lastErr;
    } catch {
      await fs.rm(tmp, { force: true }).catch(() => undefined);
      throw new StorageUnavailableError(`로컬 규칙 파일에 쓸 수 없습니다: ${this.filePath}`);
    }
  }

  async list(filter?: RuleFilter): Promise<Rule[]> {
    const all = await this.serialize(() => this.readAll());
    return sortRules(applyRuleFilter(all, filter));
  }

  async getById(id: string): Promise<Rule> {
    const all = await this.serialize(() => this.readAll());
    const found = all.find((r) => r.id === id);
    if (!found) throw new NotFoundError();
    return found;
  }

  async create(input: RuleInput): Promise<Rule> {
    const checked = validateRuleInput(input);
    if (!checked.ok) throw new ValidationError(checked.fields);
    const v = checked.value;
    return this.serialize(async () => {
      const all = await this.readAll();
      const key = ruleKey(v.nexaFn, v.targetType);
      const dup = all.find((r) => ruleKey(r.nexaFn, r.targetType) === key);
      if (dup) throw new DuplicateRuleError(dup.id);
      const now = new Date().toISOString();
      const rule: Rule = {
        id: randomUUID(),
        ...v,
        status: "PROPOSED",
        verifiedBy: null,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
        deleteReason: null,
      };
      await this.writeAll([...all, rule]);
      return rule;
    });
  }

  async updateStatus(
    id: string,
    status: RuleStatus,
    verifiedBy?: string | null,
    source?: string | null,
  ): Promise<Rule> {
    const checked = validateStatusUpdate({ status, verifiedBy, source });
    if (!checked.ok) throw new ValidationError(checked.fields);
    const v = checked.value;
    return this.serialize(async () => {
      const all = await this.readAll();
      const idx = all.findIndex((r) => r.id === id);
      if (idx < 0) throw new NotFoundError();
      const updated: Rule = {
        ...all[idx],
        status: v.status,
        verifiedBy: v.verifiedBy,
        source: v.source ?? all[idx].source,
        updatedAt: new Date().toISOString(),
      };
      const next = [...all];
      next[idx] = updated;
      await this.writeAll(next);
      return updated;
    });
  }

  async setDeleted(id: string, deleted: boolean, reason?: string | null): Promise<Rule> {
    const checked = validateDeletion({ deleted, reason });
    if (!checked.ok) throw new ValidationError(checked.fields);
    const v = checked.value;
    return this.serialize(async () => {
      const all = await this.readAll();
      const idx = all.findIndex((r) => r.id === id);
      if (idx < 0) throw new NotFoundError();
      const now = new Date().toISOString();
      const updated: Rule = {
        ...all[idx],
        deletedAt: v.deleted ? now : null,
        deleteReason: v.reason,
        updatedAt: now,
      };
      const next = [...all];
      next[idx] = updated;
      await this.writeAll(next);
      return updated;
    });
  }

  async count(): Promise<number> {
    const all = await this.serialize(() => this.readAll());
    return all.filter((r) => r.deletedAt === null).length;
  }
}
