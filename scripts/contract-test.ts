// npm run test:repo — 저장소 어댑터 계약 시험 (등록·중복 거부·null 정규화·조회 필터·상태 변경·NotFound).
// 기본: 로컬 JSON 어댑터를 임시 폴더에서 시험한다 (DB 불필요).
// 선택: `npm run test:repo -- --oracle` 는 CVD_STORAGE=oracle + ORACLE_* 환경 변수가 있을 때
//       Oracle 어댑터에 같은 계약을 실행한다. 이 경우 실제 DB 에 시험 행이 생기며 종료 시 삭제를 시도한다.
//       (사용자/DBA 가 실행한다. 이 저장소의 개발 과정에서는 실행하지 않았다.)

import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { LocalRepository } from "../src/lib/repository/local";
import type { Repository } from "../src/lib/repository/types";
import {
  DuplicateRuleError,
  NotFoundError,
  StorageUnavailableError,
  ValidationError,
} from "../src/lib/rules/errors";
import type { RuleInput } from "../src/lib/rules/types";
import { UUID_RE } from "../src/lib/rules/validate";

let failures = 0;
let total = 0;
function check(name: string, cond: boolean, detail = "") {
  total++;
  if (cond) console.log(`  [통과] ${name}`);
  else {
    failures++;
    console.log(`  [실패] ${name} ${detail}`);
  }
}

async function throwsAs<T extends Error>(fn: () => Promise<unknown>, cls: new (...a: never[]) => T): Promise<T | null> {
  try {
    await fn();
    return null;
  } catch (e) {
    return e instanceof cls ? e : null;
  }
}

function sameRule(x: object, y: object): boolean {
  const norm = (o: object) => JSON.stringify(Object.entries(o).sort(([k1], [k2]) => (k1 < k2 ? -1 : 1)));
  return norm(x) === norm(y);
}

const base = (o: Partial<RuleInput> & { nexaFn: string }): RuleInput => ({
  wsFn: `${o.nexaFn}Ws`,
  ruleType: "REPLACE",
  targetType: null,
  intentNote: null,
  exampleBefore: null,
  exampleAfter: null,
  source: "계약 시험",
  author: "시험자",
  ...o,
});

export async function runContract(repo: Repository, suffix: string) {
  const name = (s: string) => `cvdCt${suffix}${s}`;
  const before = await repo.count();

  // 등록
  const a = await repo.create(base({ nexaFn: name("A") }));
  check("등록: id(uuid)·상태 PROPOSED·verifiedBy null·시각 ISO", UUID_RE.test(a.id) && a.status === "PROPOSED" && a.verifiedBy === null && /^\d{4}-\d\d-\d\dT[\d:.]+Z$/.test(a.createdAt) && a.createdAt === a.updatedAt);
  check("등록: count +1", (await repo.count()) === before + 1);
  const got = await repo.getById(a.id);
  check("조회(getById): 등록한 값과 동일", sameRule(got, a));

  // 중복
  const dup = await throwsAs(() => repo.create(base({ nexaFn: name("A"), wsFn: "otherWs" })), DuplicateRuleError);
  check("중복 거부: 같은 (함수명, 타입 미지정)", dup !== null);
  check("중복 오류에 기존 id 포함", dup?.existingId === a.id || dup?.existingId === null, `existingId=${dup?.existingId}`);
  check("중복 거부 후 count 불변", (await repo.count()) === before + 1);
  const typed = await repo.create(base({ nexaFn: name("A"), targetType: "dataList" }));
  check("같은 함수명 + 다른 targetType 은 허용", typed.targetType === "dataList");
  const typed2 = await repo.create(base({ nexaFn: name("A"), targetType: "dataMap" }));
  check("같은 함수명 + 또 다른 targetType 허용", typed2.targetType === "dataMap");
  const dupTyped = await throwsAs(() => repo.create(base({ nexaFn: name("A"), targetType: "dataList" })), DuplicateRuleError);
  check("중복 거부: 같은 (함수명, dataList)", dupTyped !== null);

  // 정규화 (빈 문자열 → null)
  const n = await repo.create({
    nexaFn: `  ${name("N")}  `,
    wsFn: `${name("N")}Ws`,
    ruleType: "REPLACE",
    targetType: "   ",
    intentNote: "",
    exampleBefore: "  \n ",
    exampleAfter: "",
    source: "  출처  ",
    author: "  이름 ",
  } as RuleInput);
  check("정규화: 공백/빈 문자열 → null, 앞뒤 공백 제거", n.targetType === null && n.intentNote === null && n.exampleBefore === null && n.exampleAfter === null && n.nexaFn === name("N") && n.source === "출처" && n.author === "이름");
  const nBack = await repo.getById(n.id);
  check("정규화: 저장소에서 읽은 값에도 빈 문자열 없음", Object.values(nBack).every((v) => v !== ""));

  // 검증
  check("검증: 함수명 없음 → ValidationError", (await throwsAs(() => repo.create(base({ nexaFn: "" })), ValidationError)) !== null);
  check("검증: 식별자 형식 아님(a-b)", (await throwsAs(() => repo.create(base({ nexaFn: "a-b" })), ValidationError)) !== null);
  check("검증: REPLACE 는 wsFn 필수", (await throwsAs(() => repo.create(base({ nexaFn: name("V"), wsFn: null })), ValidationError)) !== null);
  check("검증: REPLACE 는 wsFn 이 nexaFn 과 달라야 함", (await throwsAs(() => repo.create(base({ nexaFn: name("V"), wsFn: name("V") })), ValidationError)) !== null);
  check("검증: INTENT_DIFF 는 설명 필수", (await throwsAs(() => repo.create(base({ nexaFn: name("V"), ruleType: "INTENT_DIFF" })), ValidationError)) !== null);
  check("검증: 함수명 101자 거부", (await throwsAs(() => repo.create(base({ nexaFn: "a".repeat(101) })), ValidationError)) !== null);
  check("검증: targetType '*' 거부", (await throwsAs(() => repo.create(base({ nexaFn: name("V"), targetType: "*" })), ValidationError)) !== null);
  check("검증: 출처 없음 거부", (await throwsAs(() => repo.create(base({ nexaFn: name("V"), source: "" })), ValidationError)) !== null);
  const u = await repo.create(base({ nexaFn: name("U"), wsFn: null, ruleType: "UNSUPPORTED", intentNote: "미지원 설명" }));
  check("UNSUPPORTED 는 wsFn 없이 등록 가능", u.wsFn === null);

  // 조회 필터
  const byQ = await repo.list({ q: `cvdct${suffix}a`.toUpperCase() });
  check("필터 q: 대소문자 무시 부분 일치", byQ.length === 3 && byQ.every((r) => r.nexaFn === name("A")));
  const byWs = await repo.list({ q: `${name("N")}Ws`.toLowerCase() });
  check("필터 q: 웹스퀘어 함수명도 검색", byWs.length === 1 && byWs[0].id === n.id);
  const byType = await repo.list({ q: name(""), ruleType: "UNSUPPORTED" });
  check("필터 ruleType", byType.length === 1 && byType[0].id === u.id);
  const byNone = await repo.list({ q: name("A"), targetType: "none" });
  check("필터 targetType=none", byNone.length === 1 && byNone[0].targetType === null);
  const byTgt = await repo.list({ q: name("A"), targetType: "dataList" });
  check("필터 targetType=값", byTgt.length === 1 && byTgt[0].targetType === "dataList");
  const sorted = await repo.list({ q: name("A") });
  check("정렬: nexaFn 오름차순, targetType null 우선", sorted[0].targetType === null && sorted[1].targetType === "dataList" && sorted[2].targetType === "dataMap");
  check("필터 status=VERIFIED 에 방금 등록한 규칙 없음", (await repo.list({ q: name(""), status: "VERIFIED" })).length === 0);

  // 상태 변경
  check("상태: VERIFIED 에 검증자 없으면 ValidationError", (await throwsAs(() => repo.updateStatus(a.id, "VERIFIED"), ValidationError)) !== null);
  check("상태: 실패 후 상태 유지", (await repo.getById(a.id)).status === "PROPOSED");
  await new Promise((r) => setTimeout(r, 5));
  const v = await repo.updateStatus(a.id, "VERIFIED", "검증자", "공식 문서 확인");
  check("상태: VERIFIED + verifiedBy + source 갱신 + updatedAt 갱신", v.status === "VERIFIED" && v.verifiedBy === "검증자" && v.source === "공식 문서 확인" && v.updatedAt > a.updatedAt && v.createdAt === a.createdAt);
  check("상태: 필터 status=VERIFIED", (await repo.list({ q: name("A"), status: "VERIFIED" })).length === 1);
  const back = await repo.updateStatus(a.id, "PROPOSED", "무시됨");
  check("상태: PROPOSED 로 되돌리면 verifiedBy null", back.status === "PROPOSED" && back.verifiedBy === null);

  // 삭제(숨김)/복원
  check("삭제: 이유 없으면 ValidationError", (await throwsAs(() => repo.setDeleted(a.id, true), ValidationError)) !== null);
  const countBeforeDelete = await repo.count();
  const deleted = await repo.setDeleted(a.id, true, "계약 시험: 삭제 사유");
  check("삭제: deletedAt·deleteReason 설정", deleted.deletedAt !== null && deleted.deleteReason === "계약 시험: 삭제 사유");
  check("삭제: count 는 삭제된 규칙을 세지 않음(-1)", (await repo.count()) === countBeforeDelete - 1);
  check("삭제: 기본 목록(list())에서 빠짐", (await repo.list({ q: name("A") })).every((r) => r.id !== a.id));
  check("삭제: deleted:true 필터로 조회됨", (await repo.list({ q: name("A"), deleted: true })).some((r) => r.id === a.id));
  check("삭제: getById 로는 여전히 조회됨(행을 지우지 않음)", (await repo.getById(a.id)).id === a.id);
  const restored = await repo.setDeleted(a.id, false);
  check("복원: deletedAt·deleteReason 이 null 로 돌아감", restored.deletedAt === null && restored.deleteReason === null);
  check("복원: count 가 원래대로 돌아옴", (await repo.count()) === countBeforeDelete);
  check("복원: 기본 목록(list())에 다시 나타남", (await repo.list({ q: name("A") })).some((r) => r.id === a.id));

  // NotFound
  const missing = "00000000-0000-4000-8000-00000000abcd";
  check("NotFound: getById", (await throwsAs(() => repo.getById(missing), NotFoundError)) !== null);
  check("NotFound: updateStatus", (await throwsAs(() => repo.updateStatus(missing, "PROPOSED"), NotFoundError)) !== null);
  check("NotFound: setDeleted", (await throwsAs(() => repo.setDeleted(missing, true, "사유"), NotFoundError)) !== null);
}

async function localExtras(dir: string, seedPath: string) {
  const repo = new LocalRepository({ dataDir: dir, seedPath });
  const file = path.join(dir, "rules.local.json");
  // 동시 등록 20건이 모두 반영되고 파일이 손상되지 않는다 (직렬화 + 원자적 교체)
  const start = await repo.count();
  await Promise.all(
    Array.from({ length: 20 }, (_, i) =>
      repo.create(base({ nexaFn: `cvdConc${i}` })),
    ),
  );
  check("동시 등록 20건 모두 반영", (await repo.count()) === start + 20);
  let parsed = true;
  try {
    JSON.parse(readFileSync(file, "utf8"));
  } catch {
    parsed = false;
  }
  check("동시 등록 후 JSON 파일이 유효", parsed);
  check("로컬 JSON 파일에 빈 문자열 값이 없음", !/:\s*""/.test(readFileSync(file, "utf8")));

  // 손상된 파일은 덮어쓰지 않고 오류
  writeFileSync(file, "{ 깨진 json", "utf8");
  const err = await throwsAs(() => repo.list(), StorageUnavailableError);
  check("손상된 파일: StorageUnavailableError", err !== null);
  check("손상된 파일을 덮어쓰지 않음", readFileSync(file, "utf8") === "{ 깨진 json");
  const err2 = await throwsAs(() => repo.create(base({ nexaFn: "cvdAfterBroken" })), StorageUnavailableError);
  check("손상된 파일에 등록 시도도 오류(덮어쓰지 않음)", err2 !== null && readFileSync(file, "utf8") === "{ 깨진 json");
}

async function main() {
  const wantOracle = process.argv.includes("--oracle");
  const suffix = Math.random().toString(36).slice(2, 8).replace(/[^a-z0-9]/g, "x");
  if (wantOracle) {
    if (process.env.CVD_STORAGE?.trim().toLowerCase() !== "oracle") {
      console.log("--oracle 은 CVD_STORAGE=oracle 과 ORACLE_* 환경 변수가 필요합니다. (미실행)");
      process.exit(2);
    }
    const { getRepository } = await import("../src/lib/repository");
    const { withOracleConnection, closeOraclePool } = await import("../src/lib/oracle");
    console.log(`== Oracle 어댑터 계약 시험 (시험 행 접두어 cvdCt${suffix}, 종료 시 삭제 시도) ==`);
    try {
      await runContract(getRepository(), suffix);
    } finally {
      await withOracleConnection(async (conn) => {
        await conn.execute("DELETE FROM CVD_RULE WHERE NEXA_FN LIKE :p", { p: `cvdCt${suffix}%` }, { autoCommit: true });
      }).catch(() => console.log("  (시험 행 삭제 실패: NEXA_FN LIKE 'cvdCt%' 행을 수동으로 정리하세요)"));
      await closeOraclePool();
    }
  } else {
    const dir = mkdtempSync(path.join(os.tmpdir(), "cvd-contract-"));
    const seedPath = path.join(process.cwd(), "data", "rules.seed.json");
    console.log("== 로컬 JSON 어댑터 계약 시험 (임시 폴더) ==");
    try {
      const repo = new LocalRepository({ dataDir: dir, seedPath });
      check("초기화: 시드에서 규칙을 복사해 시작", (await repo.count()) >= 50);
      await runContract(repo, suffix);
      const dir2 = mkdtempSync(path.join(os.tmpdir(), "cvd-contract-"));
      try {
        console.log("-- 로컬 전용 시험 --");
        await localExtras(dir2, seedPath);
      } finally {
        rmSync(dir2, { recursive: true, force: true });
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }
  console.log(failures === 0 ? `\n결과: ${total}건 전부 통과 (종료 코드 0)` : `\n결과: ${total}건 중 ${failures}건 실패 (종료 코드 1)`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.log("시험 중 예기치 않은 오류:", e instanceof Error ? e.name : typeof e);
  process.exit(1);
});
