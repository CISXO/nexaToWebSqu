// JSON 규칙 → Oracle(CVD_RULE) 가져오기 스크립트.  ※ 사용자/DBA 가 실행한다 (개발 과정에서는 실행하지 않았다).
//
// 사용법 (jjh-app 폴더에서):
//   npx tsx db/import-json-to-oracle.ts [json경로]                  # 드라이런(기본): 삽입 예정/건너뜀 건수만 출력
//   npx tsx db/import-json-to-oracle.ts [json경로] --apply          # 실제 반영
//   npx tsx db/import-json-to-oracle.ts [json경로] --apply --update-status   # 이미 있는 규칙의 상태/검증자도 갱신
// 접속: ORACLE_USER / ORACLE_PASSWORD / ORACLE_CONNECT_STRING 환경 변수 (예: node 의 --env-file 로 .env.local 지정)
//   npx tsx --env-file=.env.local db/import-json-to-oracle.ts --apply
// 기본 입력: data/rules.local.json (없으면 data/rules.seed.json)
//
// 성질
//   - 멱등: 유일성 키(NEXA_FN, NVL(TARGET_TYPE,'*'))가 이미 있으면 건너뛴다. 재실행해도 건수가 늘지 않는다.
//   - 바인드 변수만 사용, 하나의 트랜잭션으로 커밋(오류 시 롤백). 접속 정보는 출력하지 않는다.
//   - 각 행은 정규화·검증을 통과해야 반영된다. 실패한 행은 건너뛰고 사유를 요약 출력한다.

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { closeOraclePool, missingOracleEnv, withOracleConnection } from "../src/lib/oracle";
import { insertRuleRow, mapOracleError, selectAllRules, updateStatusRow } from "../src/lib/repository/oracle";
import { ruleKey, type Rule } from "../src/lib/rules/types";
import {
  UUID_RE,
  isRuleStatus,
  normalizeText,
  validateRuleInput,
  validateStatusUpdate,
} from "../src/lib/rules/validate";

const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

interface Skip {
  label: string;
  reason: string;
}

function parseArgs(argv: string[]) {
  const apply = argv.includes("--apply");
  const updateStatus = argv.includes("--update-status");
  const file = argv.find((a) => !a.startsWith("--"));
  return { apply, updateStatus, file };
}

function loadRules(file: string | undefined): { rules: unknown[]; from: string } {
  const root = process.cwd();
  const candidates = file
    ? [path.resolve(file)]
    : [path.join(root, "data", "rules.local.json"), path.join(root, "data", "rules.seed.json")];
  const found = candidates.find((c) => existsSync(c));
  if (!found) throw new Error(`입력 JSON 파일을 찾을 수 없습니다: ${candidates.join(" | ")}`);
  const parsed = JSON.parse(readFileSync(found, "utf8")) as unknown;
  const rules = Array.isArray(parsed)
    ? parsed
    : (parsed as { rules?: unknown[] } | null)?.rules;
  if (!Array.isArray(rules)) throw new Error("JSON 형식이 올바르지 않습니다(배열 또는 { rules: [] } 필요).");
  return { rules, from: found };
}

/** 파일의 한 항목을 검증·정규화해 Rule 로 만든다. 실패 시 사유 문자열. */
function toValidRule(raw: unknown): { rule: Rule } | { reason: string } {
  const checked = validateRuleInput(raw);
  if (!checked.ok) return { reason: `검증 실패: ${Object.keys(checked.fields).join(", ")}` };
  const r = raw as Record<string, unknown>;
  const id = typeof r.id === "string" ? r.id : "";
  if (!UUID_RE.test(id)) return { reason: "id 가 uuid 형식이 아님" };
  const status = r.status;
  if (!isRuleStatus(status)) return { reason: "status 가 올바르지 않음" };
  const st = validateStatusUpdate({ status, verifiedBy: r.verifiedBy, source: null });
  if (!st.ok) return { reason: `상태 검증 실패: ${Object.keys(st.fields).join(", ")}` };
  const createdAt = typeof r.createdAt === "string" && ISO_RE.test(r.createdAt) ? r.createdAt : null;
  const updatedAt = typeof r.updatedAt === "string" && ISO_RE.test(r.updatedAt) ? r.updatedAt : null;
  if (!createdAt || !updatedAt) return { reason: "createdAt/updatedAt 이 UTC ISO 형식이 아님" };
  // 삭제 상태(선택): 삭제 시각이 올바를 때만 삭제된 것으로 옮긴다. 삭제 기능 이전 파일에는 없다.
  const deletedAt = typeof r.deletedAt === "string" && ISO_RE.test(r.deletedAt) ? r.deletedAt : null;
  return {
    rule: {
      id,
      ...checked.value,
      status: st.value.status,
      verifiedBy: st.value.verifiedBy,
      createdAt,
      updatedAt,
      deletedAt,
      deleteReason: deletedAt ? normalizeText(r.deleteReason) : null,
    },
  };
}

async function main() {
  const { apply, updateStatus, file } = parseArgs(process.argv.slice(2));
  const missing = missingOracleEnv();
  if (missing.length > 0) {
    console.error(`Oracle 접속 환경 변수가 없습니다: ${missing.join(", ")} (값은 출력하지 않습니다)`);
    process.exit(2);
  }
  const { rules: rawRules, from } = loadRules(file);
  console.log(`입력: ${from} (${rawRules.length}건)`);
  console.log(apply ? "모드: 반영(--apply)" : "모드: 드라이런 (반영하려면 --apply)");

  const valid: Rule[] = [];
  const skipped: Skip[] = [];
  const seenKeys = new Set<string>();
  for (const [i, raw] of rawRules.entries()) {
    const label = `#${i + 1} ${normalizeText((raw as { nexaFn?: unknown } | null)?.nexaFn) ?? "(함수명 없음)"}`;
    const res = toValidRule(raw);
    if ("reason" in res) {
      skipped.push({ label, reason: res.reason });
      continue;
    }
    const key = ruleKey(res.rule.nexaFn, res.rule.targetType);
    if (seenKeys.has(key)) {
      skipped.push({ label, reason: "파일 안에서 (함수명, 대상 타입) 중복" });
      continue;
    }
    seenKeys.add(key);
    valid.push(res.rule);
  }

  let inserted = 0;
  let existing = 0;
  let statusUpdated = 0;
  try {
    await withOracleConnection(async (conn) => {
      const current = await selectAllRules(conn);
      const byKey = new Map(current.map((r) => [ruleKey(r.nexaFn, r.targetType), r]));
      const ids = new Set(current.map((r) => r.id));
      try {
        for (const rule of valid) {
          const found = byKey.get(ruleKey(rule.nexaFn, rule.targetType));
          if (found) {
            existing++;
            if (updateStatus && (found.status !== rule.status || found.verifiedBy !== rule.verifiedBy)) {
              statusUpdated++;
              if (apply) {
                await updateStatusRow(conn, found.id, rule.status, rule.verifiedBy, found.source, new Date().toISOString());
              }
            }
            continue;
          }
          if (ids.has(rule.id)) {
            skipped.push({ label: rule.nexaFn, reason: "같은 id 가 다른 (함수명, 타입) 규칙으로 이미 있음" });
            continue;
          }
          inserted++;
          if (apply) await insertRuleRow(conn, rule);
        }
        if (apply) await conn.commit();
      } catch (e) {
        await conn.rollback().catch(() => undefined);
        throw e;
      }
    });
  } catch (e) {
    console.error(`가져오기 실패(전체 롤백됨): ${mapOracleError(e).message}`);
    process.exitCode = 1;
    return;
  } finally {
    await closeOraclePool();
  }

  console.log(`\n결과 (${apply ? "반영됨" : "드라이런, DB 변경 없음"})`);
  console.log(`  삽입${apply ? "" : " 예정"}: ${inserted}건`);
  console.log(`  이미 존재(건너뜀): ${existing}건`);
  if (updateStatus) console.log(`  상태 갱신${apply ? "" : " 예정"}: ${statusUpdated}건`);
  console.log(`  검증 실패/충돌로 제외: ${skipped.length}건`);
  for (const s of skipped) console.log(`    - ${s.label}: ${s.reason}`);
}

main().catch((e) => {
  console.error("가져오기 중 오류:", e instanceof Error ? e.message : "알 수 없는 오류");
  process.exit(1);
});
