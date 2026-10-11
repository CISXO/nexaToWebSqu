// Oracle 어댑터. 전용 테이블 CVD_RULE 만 사용한다 (db/01_create_cvd_rule.sql).
// - 모든 SQL 은 바인드 변수만 쓴다(문자열 연결로 값을 넣지 않는다).
// - 커넥션은 withOracleConnection 이 finally 에서 반환한다.
// - 시각은 UTC ISO 문자열로 주고받는다: TO_TIMESTAMP / TO_CHAR 로 변환해 세션 시간대 영향을 없앤다.
// - ORA-00001(유니크 위반) → DuplicateRuleError. 그 외 ORA 오류는 코드만 노출하는 StorageUnavailableError.
// 주의: 이 어댑터는 사내 Oracle 이 없는 환경에서 작성되어 실제 실행 검증이 되지 않았다(dev-report 참조).

import { randomUUID } from "node:crypto";
import type { Connection } from "oracledb";
import { describeOracleError, getOracleDb, withOracleConnection } from "../oracle";
import {
  DuplicateRuleError,
  NotFoundError,
  StorageUnavailableError,
  ValidationError,
} from "../rules/errors";
import { applyRuleFilter, sortRules } from "../rules/filter";
import { ruleKey, type Rule, type RuleFilter, type RuleInput, type RuleStatus } from "../rules/types";
import { validateDeletion, validateRuleInput, validateStatusUpdate } from "../rules/validate";
import type { Repository } from "./types";

const TS_FORMAT = `YYYY-MM-DD"T"HH24:MI:SS.FF3"Z"`;

const SELECT_COLUMNS = `
  RULE_ID, NEXA_FN, WS_FN, RULE_TYPE, TARGET_TYPE, INTENT_NOTE, EXAMPLE_BEFORE, EXAMPLE_AFTER,
  SRC_REF, RULE_STATUS, AUTHOR_NAME, VERIFIED_BY,
  TO_CHAR(CREATED_AT, '${TS_FORMAT}') AS CREATED_AT,
  TO_CHAR(UPDATED_AT, '${TS_FORMAT}') AS UPDATED_AT,
  TO_CHAR(DELETED_AT, '${TS_FORMAT}') AS DELETED_AT, DELETE_REASON`;

// SELECT_COLUMNS 는 상수 텍스트만 포함한다(사용자 입력 없음).
const SQL_SELECT_ALL = `SELECT ${SELECT_COLUMNS} FROM CVD_RULE`;
const SQL_SELECT_BY_ID = `SELECT ${SELECT_COLUMNS} FROM CVD_RULE WHERE RULE_ID = :id`;
const SQL_SELECT_BY_KEY = `SELECT RULE_ID FROM CVD_RULE WHERE NEXA_FN = :nexaFn AND NVL(TARGET_TYPE, '*') = :tgt`;
const SQL_COUNT = `SELECT COUNT(*) AS CNT FROM CVD_RULE WHERE DELETED_AT IS NULL`;
const SQL_INSERT = `
  INSERT INTO CVD_RULE (
    RULE_ID, NEXA_FN, WS_FN, RULE_TYPE, TARGET_TYPE, INTENT_NOTE, EXAMPLE_BEFORE, EXAMPLE_AFTER,
    SRC_REF, RULE_STATUS, AUTHOR_NAME, VERIFIED_BY, CREATED_AT, UPDATED_AT, DELETED_AT, DELETE_REASON
  ) VALUES (
    :id, :nexaFn, :wsFn, :ruleType, :targetType, :intentNote, :exampleBefore, :exampleAfter,
    :src, :status, :author, :verifiedBy,
    TO_TIMESTAMP(:createdAt, '${TS_FORMAT}'), TO_TIMESTAMP(:updatedAt, '${TS_FORMAT}'),
    TO_TIMESTAMP(:deletedAt, '${TS_FORMAT}'), :deleteReason
  )`;
const SQL_UPDATE_STATUS = `
  UPDATE CVD_RULE
     SET RULE_STATUS = :status, VERIFIED_BY = :verifiedBy, SRC_REF = :src,
         UPDATED_AT = TO_TIMESTAMP(:updatedAt, '${TS_FORMAT}')
   WHERE RULE_ID = :id`;
const SQL_UPDATE_DELETION = `
  UPDATE CVD_RULE
     SET DELETED_AT = TO_TIMESTAMP(:deletedAt, '${TS_FORMAT}'), DELETE_REASON = :deleteReason,
         UPDATED_AT = TO_TIMESTAMP(:updatedAt, '${TS_FORMAT}')
   WHERE RULE_ID = :id`;

type Row = Record<string, unknown>;

function s(v: unknown): string | null {
  // Oracle 은 ''를 NULL 로 저장하므로 읽을 때도 null 로 통일한다.
  if (v === null || v === undefined) return null;
  const str = String(v);
  return str === "" ? null : str;
}

function toRule(row: Row): Rule {
  return {
    id: String(row.RULE_ID),
    nexaFn: String(row.NEXA_FN),
    wsFn: s(row.WS_FN),
    ruleType: String(row.RULE_TYPE) as Rule["ruleType"],
    targetType: s(row.TARGET_TYPE),
    intentNote: s(row.INTENT_NOTE),
    exampleBefore: s(row.EXAMPLE_BEFORE),
    exampleAfter: s(row.EXAMPLE_AFTER),
    source: String(row.SRC_REF),
    status: String(row.RULE_STATUS) as RuleStatus,
    author: String(row.AUTHOR_NAME),
    verifiedBy: s(row.VERIFIED_BY),
    createdAt: String(row.CREATED_AT),
    updatedAt: String(row.UPDATED_AT),
    deletedAt: s(row.DELETED_AT),
    deleteReason: s(row.DELETE_REASON),
  };
}

/** CLOB 컬럼을 문자열로 읽도록 하는 fetchInfo (모든 조회에 사용). */
async function fetchOptions() {
  const db = await getOracleDb();
  return {
    outFormat: db.OUT_FORMAT_OBJECT,
    fetchInfo: {
      INTENT_NOTE: { type: db.STRING },
      EXAMPLE_BEFORE: { type: db.STRING },
      EXAMPLE_AFTER: { type: db.STRING },
    },
  };
}

function insertBinds(rule: Rule) {
  return {
    id: rule.id,
    nexaFn: rule.nexaFn,
    wsFn: rule.wsFn,
    ruleType: rule.ruleType,
    targetType: rule.targetType,
    intentNote: rule.intentNote,
    exampleBefore: rule.exampleBefore,
    exampleAfter: rule.exampleAfter,
    src: rule.source,
    status: rule.status,
    author: rule.author,
    verifiedBy: rule.verifiedBy,
    createdAt: rule.createdAt,
    updatedAt: rule.updatedAt,
    deletedAt: rule.deletedAt,
    deleteReason: rule.deleteReason,
  };
}

/** 오류를 어댑터 공통 오류로 변환한다. 이미 도메인 오류면 그대로 둔다. */
export function mapOracleError(e: unknown): Error {
  if (
    e instanceof DuplicateRuleError ||
    e instanceof NotFoundError ||
    e instanceof ValidationError ||
    e instanceof StorageUnavailableError
  ) {
    return e;
  }
  const errorNum = (e as { errorNum?: number } | null)?.errorNum;
  if (errorNum === 1 || (e instanceof Error && /\bORA-00001\b/.test(e.message))) {
    return new DuplicateRuleError();
  }
  return new StorageUnavailableError(describeOracleError(e));
}

// ---- 가져오기 스크립트에서도 쓰는 저수준 함수 (커넥션을 인자로 받는다) ----

export async function selectAllRules(conn: Connection): Promise<Rule[]> {
  const res = await conn.execute<Row>(SQL_SELECT_ALL, [], await fetchOptions());
  return (res.rows ?? []).map(toRule);
}

export async function insertRuleRow(conn: Connection, rule: Rule): Promise<void> {
  await conn.execute(SQL_INSERT, insertBinds(rule), { autoCommit: false });
}

export async function updateStatusRow(
  conn: Connection,
  id: string,
  status: RuleStatus,
  verifiedBy: string | null,
  source: string,
  updatedAt: string,
): Promise<number> {
  const res = await conn.execute(
    SQL_UPDATE_STATUS,
    { status, verifiedBy, src: source, updatedAt, id },
    { autoCommit: false },
  );
  return res.rowsAffected ?? 0;
}

// -------------------------------------------------------------------------------

export class OracleRepository implements Repository {
  readonly kind = "oracle" as const;

  async list(filter?: RuleFilter): Promise<Rule[]> {
    try {
      const all = await withOracleConnection((conn) => selectAllRules(conn));
      return sortRules(applyRuleFilter(all, filter));
    } catch (e) {
      throw mapOracleError(e);
    }
  }

  async getById(id: string): Promise<Rule> {
    try {
      const rows = await withOracleConnection(async (conn) =>
        conn.execute<Row>(SQL_SELECT_BY_ID, { id }, await fetchOptions()),
      );
      const row = rows.rows?.[0];
      if (!row) throw new NotFoundError();
      return toRule(row);
    } catch (e) {
      throw mapOracleError(e);
    }
  }

  async create(input: RuleInput): Promise<Rule> {
    const checked = validateRuleInput(input);
    if (!checked.ok) throw new ValidationError(checked.fields);
    const now = new Date().toISOString();
    const rule: Rule = {
      id: randomUUID(),
      ...checked.value,
      status: "PROPOSED",
      verifiedBy: null,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      deleteReason: null,
    };
    try {
      await withOracleConnection(async (conn) => {
        try {
          await insertRuleRow(conn, rule);
          await conn.commit();
        } catch (e) {
          await conn.rollback().catch(() => undefined);
          throw e;
        }
      });
      return rule;
    } catch (e) {
      const mapped = mapOracleError(e);
      if (mapped instanceof DuplicateRuleError) {
        const existingId = await this.findExistingId(rule.nexaFn, rule.targetType).catch(
          () => null,
        );
        throw new DuplicateRuleError(existingId);
      }
      throw mapped;
    }
  }

  private async findExistingId(nexaFn: string, targetType: string | null): Promise<string | null> {
    const key = ruleKey(nexaFn, targetType).split("\u0000")[1];
    const res = await withOracleConnection((conn) =>
      conn.execute<Row>(SQL_SELECT_BY_KEY, { nexaFn, tgt: key }),
    );
    const row = res.rows?.[0];
    return row ? String(row.RULE_ID) : null;
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
    try {
      const current = await this.getById(id);
      await withOracleConnection(async (conn) => {
        try {
          const affected = await updateStatusRow(
            conn,
            id,
            v.status,
            v.verifiedBy,
            v.source ?? current.source,
            new Date().toISOString(),
          );
          if (affected === 0) throw new NotFoundError();
          await conn.commit();
        } catch (e) {
          await conn.rollback().catch(() => undefined);
          throw e;
        }
      });
      return await this.getById(id);
    } catch (e) {
      throw mapOracleError(e);
    }
  }

  async setDeleted(id: string, deleted: boolean, reason?: string | null): Promise<Rule> {
    const checked = validateDeletion({ deleted, reason });
    if (!checked.ok) throw new ValidationError(checked.fields);
    const v = checked.value;
    const now = new Date().toISOString();
    try {
      await withOracleConnection(async (conn) => {
        try {
          const res = await conn.execute(
            SQL_UPDATE_DELETION,
            { deletedAt: v.deleted ? now : null, deleteReason: v.reason, updatedAt: now, id },
            { autoCommit: false },
          );
          if ((res.rowsAffected ?? 0) === 0) throw new NotFoundError();
          await conn.commit();
        } catch (e) {
          await conn.rollback().catch(() => undefined);
          throw e;
        }
      });
      return await this.getById(id);
    } catch (e) {
      throw mapOracleError(e);
    }
  }

  async count(): Promise<number> {
    try {
      const res = await withOracleConnection((conn) => conn.execute<Row>(SQL_COUNT));
      return Number(res.rows?.[0]?.CNT ?? 0);
    } catch (e) {
      throw mapOracleError(e);
    }
  }
}
