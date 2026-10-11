// Oracle 연결 풀 (지연 로딩). CVD_STORAGE=oracle 일 때만 사용된다.
// - oracledb 는 이 모듈의 함수가 호출될 때 처음 로드한다(로컬 모드 기동·빌드가 영향받지 않도록).
// - 접속 정보는 process.env 로만 읽고, 값을 로그·오류에 출력하지 않는다(누락된 변수의 '이름'만 안내).

import type { Connection, Pool } from "oracledb";
import { StorageUnavailableError } from "./rules/errors";

type OracleDbModule = typeof import("oracledb");

const g = globalThis as unknown as {
  __cvdOraclePool?: Promise<Pool>;
  __cvdOracleModule?: Promise<OracleDbModule>;
};

const REQUIRED_ENV = ["ORACLE_USER", "ORACLE_PASSWORD", "ORACLE_CONNECT_STRING"] as const;

export function missingOracleEnv(): string[] {
  return REQUIRED_ENV.filter((n) => !process.env[n]?.trim());
}

/** ORA-/NJS-/DPY- 코드만 뽑아 일반화된 문구를 만든다(접속 문자열·자격 증명 노출 방지). */
export function describeOracleError(e: unknown): string {
  const msg = e instanceof Error ? e.message : "";
  const code = /\b(ORA|NJS|DPY)-\d{3,5}\b/.exec(msg)?.[0];
  if (code === "ORA-00942") {
    return "CVD_RULE 테이블을 찾을 수 없습니다(ORA-00942). db/01_create_cvd_rule.sql 이 실행되었는지 DBA에게 확인하세요.";
  }
  return code
    ? `Oracle 저장소에 접근할 수 없습니다(${code}). 접속 설정을 확인하거나 CVD_STORAGE=local 로 실행하세요.`
    : "Oracle 저장소에 접근할 수 없습니다. 접속 설정을 확인하거나 CVD_STORAGE=local 로 실행하세요.";
}

export async function getOracleDb(): Promise<OracleDbModule> {
  if (!g.__cvdOracleModule) {
    g.__cvdOracleModule = import("oracledb").then((m) => {
      const mod = ((m as unknown as { default?: OracleDbModule }).default ?? m) as OracleDbModule;
      mod.outFormat = mod.OUT_FORMAT_OBJECT;
      return mod;
    });
  }
  try {
    return await g.__cvdOracleModule;
  } catch {
    g.__cvdOracleModule = undefined;
    throw new StorageUnavailableError(
      "oracledb 모듈을 불러올 수 없습니다. npm install 을 확인하거나 CVD_STORAGE=local 로 실행하세요.",
    );
  }
}

export async function getOraclePool(): Promise<Pool> {
  const missing = missingOracleEnv();
  if (missing.length > 0) {
    throw new StorageUnavailableError(
      `Oracle 접속 환경 변수가 없습니다: ${missing.join(", ")}. .env.local 을 확인하거나 CVD_STORAGE 를 제거(로컬 저장소)하세요.`,
    );
  }
  if (!g.__cvdOraclePool) {
    const db = await getOracleDb();
    g.__cvdOraclePool = db
      .createPool({
        user: process.env.ORACLE_USER,
        password: process.env.ORACLE_PASSWORD,
        connectString: process.env.ORACLE_CONNECT_STRING,
        poolMin: 0,
        poolMax: 5,
        poolIncrement: 1,
      })
      .catch((e: unknown) => {
        g.__cvdOraclePool = undefined;
        throw new StorageUnavailableError(describeOracleError(e));
      });
  }
  return g.__cvdOraclePool;
}

/** 커넥션을 빌려 fn 을 실행하고 반드시 반환한다. */
export async function withOracleConnection<T>(
  fn: (conn: Connection) => Promise<T>,
): Promise<T> {
  const pool = await getOraclePool();
  let conn: Connection;
  try {
    conn = await pool.getConnection();
  } catch (e) {
    throw new StorageUnavailableError(describeOracleError(e));
  }
  try {
    return await fn(conn);
  } finally {
    await conn.close().catch(() => undefined);
  }
}

/** 스크립트(가져오기 등) 종료 시 풀을 닫는다. */
export async function closeOraclePool(): Promise<void> {
  if (!g.__cvdOraclePool) return;
  const pool = await g.__cvdOraclePool.catch(() => null);
  g.__cvdOraclePool = undefined;
  if (pool) await pool.close(0).catch(() => undefined);
}
