// npm run check:seed — 시드(data/rules.seed.json)가 plan.md §11, AC-21 을 지키는지 점검한다.

import { readFileSync } from "node:fs";
import path from "node:path";
import { ruleKey, type Rule } from "../src/lib/rules/types";
import { UUID_RE, validateRuleInput } from "../src/lib/rules/validate";

const seedPath = path.join(process.cwd(), "data", "rules.seed.json");
const rules = (JSON.parse(readFileSync(seedPath, "utf8")) as { rules: Rule[] }).rules;

let failures = 0;
const fail = (m: string) => {
  failures++;
  console.log(`  [실패] ${m}`);
};
const pass = (m: string) => console.log(`  [통과] ${m}`);

// (a) 건수
if (rules.length >= 50 && rules.length <= 100) pass(`건수 ${rules.length} (50~100)`);
else fail(`건수 ${rules.length} 가 50~100 범위 밖`);

// 형식·중복
const keys = new Set<string>();
const ids = new Set<string>();
let invalid = 0;
for (const r of rules) {
  const v = validateRuleInput(r);
  if (!v.ok) {
    invalid++;
    fail(`${r.nexaFn}: 검증 실패 ${JSON.stringify(v.fields)}`);
  }
  if (!UUID_RE.test(r.id)) fail(`${r.nexaFn}: id 형식 오류`);
  const k = ruleKey(r.nexaFn, r.targetType);
  if (keys.has(k)) fail(`유일성 키 중복: ${r.nexaFn}`);
  keys.add(k);
  if (ids.has(r.id)) fail(`id 중복: ${r.id}`);
  ids.add(r.id);
  for (const [name, val] of Object.entries(r)) {
    if (val === "") fail(`${r.nexaFn}.${name}: 빈 문자열`);
  }
}
if (invalid === 0) pass("모든 규칙이 서버 검증(validateRuleInput)을 통과");

// (c) VERIFIED 0건, (d) source 존재
if (rules.every((r) => r.status === "PROPOSED" && r.verifiedBy === null)) pass("VERIFIED 0건 (전부 PROPOSED)");
else fail("PROPOSED 가 아닌 규칙이 있음");
if (rules.every((r) => r.source.trim().length > 0)) pass("모든 규칙에 source 존재");
else fail("source 가 비어 있는 규칙이 있음");

// (b) REF-01 ~ REF-06 은 plan.md 11.2 값과 동일
const REF = (n: number) => `REF-0${n} | 평가용 가상 규칙 (DEMO, 실제 API 아님)`;
const expectedRefs: Partial<Rule>[] = [
  {
    nexaFn: "getRowCount", wsFn: "getCount", ruleType: "INTENT_DIFF", targetType: null,
    intentNote: "[미검증] problem.txt 2-1에서 전환 후 함수의 반환 의미가 기존 의도와 다르다고 제보됨. 구체적 반환 의미는 공식 API 문서 또는 실동작으로 확인한 뒤 이 설명을 갱신할 것.",
    exampleBefore: "var n = ds_main.getRowCount();", exampleAfter: "var n = map.getCount(); // 반환 의미 확인 필요",
    source: "REF-01 | problem.txt 2-1 사용자 제보 (미검증)", status: "PROPOSED", author: "기획(problem.txt)",
  },
  { nexaFn: "demoAddRow", wsFn: "demoInsertRow", ruleType: "REPLACE", targetType: "dataList", intentNote: null, exampleBefore: "dlt_list.demoAddRow();", exampleAfter: "dlt_list.demoInsertRow();", source: REF(2), status: "PROPOSED", author: "기획(DEMO)" },
  { nexaFn: "demoAddRow", wsFn: "demoAppendRow", ruleType: "REPLACE", targetType: null, intentNote: null, exampleBefore: "x.demoAddRow();", exampleAfter: "x.demoAppendRow();", source: REF(3), status: "PROPOSED", author: "기획(DEMO)" },
  { nexaFn: "demoSetCol", wsFn: "demoSetCell", ruleType: "REPLACE", targetType: null, intentNote: null, exampleBefore: 'f.demoSetCol(0,"A","v");', exampleAfter: 'f.demoSetCell(0,"A","v");', source: REF(4), status: "PROPOSED", author: "기획(DEMO)" },
  {
    nexaFn: "demoClear", wsFn: null, ruleType: "UNSUPPORTED", targetType: "dataList",
    intentNote: "[DEMO] 가상 규칙: 웹스퀘어에 대응 기능이 없다고 가정한 예. 삭제 후 재조회 등 수동 작성 필요.",
    exampleBefore: "dlt_list.demoClear();", exampleAfter: null, source: REF(5), status: "PROPOSED", author: "기획(DEMO)",
  },
  { nexaFn: "demoGetCol", wsFn: "demoGetCell", ruleType: "REPLACE", targetType: "dataMap", intentNote: null, exampleBefore: 'f.demoGetCol(0,"A");', exampleAfter: 'f.demoGetCell(0,"A");', source: REF(6), status: "PROPOSED", author: "기획(DEMO)" },
];
let refOk = true;
for (const exp of expectedRefs) {
  const found = rules.find((r) => r.source === exp.source);
  if (!found) {
    refOk = false;
    fail(`${exp.source} 규칙이 없음`);
    continue;
  }
  for (const [k, v] of Object.entries(exp)) {
    if ((found as unknown as Record<string, unknown>)[k] !== v) {
      refOk = false;
      fail(`${exp.source}: ${k} 값이 기획서와 다름`);
    }
  }
}
if (refOk) pass("REF-01~REF-06 이 기획서 11.2 와 동일");

// (e) AI 초안 규칙
const drafts = rules.filter((r) => !/^REF-0[1-6] \|/.test(r.source));
const draftOk = drafts.every(
  (r) => r.source.includes("AI 초안") && r.author === "AI-초안" && (r.intentNote ?? "").startsWith("[미검증 초안]"),
);
if (draftOk) pass(`AI 초안 ${drafts.length}건: source 에 'AI 초안', intentNote 는 '[미검증 초안]' 으로 시작`);
else fail("AI 초안 규칙의 source/author/intentNote 규율 위반");

// (h) 충돌 방지 제약
const forbidden = ["getRowCount", "getCount", "demoAddRow", "demoSetCol", "demoClear", "demoGetCol", "demoInsertRow", "demoAppendRow", "demoSetCell", "demoGetCell"];
const conflict = drafts.filter(
  (r) => forbidden.includes(r.nexaFn) || (r.ruleType === "INTENT_DIFF" && r.wsFn === "getCount") || (r.wsFn !== null && forbidden.includes(r.wsFn) && r.ruleType === "INTENT_DIFF"),
);
if (conflict.length === 0) pass("충돌 방지 제약 준수(AI 초안이 정답표 함수명과 겹치지 않음)");
else fail(`충돌 방지 제약 위반: ${conflict.map((r) => r.nexaFn).join(",")}`);

// (f)(g) 의미 단정·민감 문자열
const bad = rules.filter((r) => /열의 개수|테이블 개수|ORACLE_|password|jdbc:|@[A-Za-z0-9.-]+:\d{4}/i.test(JSON.stringify(r)));
if (bad.length === 0) pass("getRowCount/getCount 의미 단정 문구·접속 정보 없음");
else fail(`금지 문구 포함: ${bad.map((r) => r.nexaFn).join(",")}`);

console.log(failures === 0 ? "\n결과: 통과 (종료 코드 0)" : `\n결과: 실패 ${failures}건 (종료 코드 1)`);
process.exit(failures === 0 ? 0 : 1);
