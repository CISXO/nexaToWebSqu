// npm run check:sample — 스캐너·변경 순수 함수를 plan.md 정답표(scripts/sample-expected.json)와 대조한다.
// 전부 일치하면 종료 코드 0, 하나라도 다르면 1.

import { readFileSync } from "node:fs";
import path from "node:path";
import {
  applyChangeRequests,
  buildBulkItems,
  previewChange,
  toChangeRequest,
} from "../src/lib/diff/apply";
import { splitLines } from "../src/lib/scanner/lines";
import { scanSource } from "../src/lib/scanner/scan";
import type { Finding } from "../src/lib/scanner/types";
import type { Rule } from "../src/lib/rules/types";

interface ExpectedFinding {
  line: number;
  fn: string;
  ref: string;
  ruleType: string;
  confidence: string;
  side: string;
  changeable: boolean;
}

const root = process.cwd();
const expected = JSON.parse(readFileSync(path.join(root, "scripts", "sample-expected.json"), "utf8"));
const seed = JSON.parse(readFileSync(path.join(root, "data", "rules.seed.json"), "utf8")) as {
  rules: Rule[];
};
const rules = seed.rules;

let failures = 0;
function fail(msg: string) {
  failures++;
  console.log(`  [실패] ${msg}`);
}
function pass(msg: string) {
  console.log(`  [통과] ${msg}`);
}

function refOf(f: Finding): string {
  const rule = rules.find((r) => r.id === f.ruleId);
  const m = rule ? /^(REF-\d+)\b/.exec(rule.source) : null;
  return m ? m[1] : `(REF 아님:${rule?.nexaFn ?? f.ruleId})`;
}

function sig(x: { line: number; fn: string; ref: string; ruleType: string; confidence: string; side: string; changeable: boolean }) {
  return [x.line, x.fn, x.ref, x.ruleType, x.confidence, x.side, x.changeable].join("|");
}

function compare(name: string, findings: Finding[], exp: ExpectedFinding[]) {
  const actual = findings.map((f) =>
    sig({ line: f.line, fn: f.fn, ref: refOf(f), ruleType: f.ruleType, confidence: f.confidence, side: f.side, changeable: f.changeable }),
  );
  const want = exp.map(sig);
  const missing = want.filter((w) => !actual.includes(w));
  const extra = actual.filter((a) => !want.includes(a));
  const tp = want.length - missing.length;
  console.log(`  정탐 ${tp} / 기대 ${want.length}, 미탐 ${missing.length}, 오탐 ${extra.length}, 실제 검출 ${actual.length}`);
  for (const m of missing) fail(`${name} 미탐: ${m}`);
  for (const x of extra) fail(`${name} 오탐: ${x}`);
  if (missing.length === 0 && extra.length === 0 && actual.length === want.length) {
    pass(`${name} 검출 결과가 정답표와 일치`);
  } else if (actual.length !== want.length) {
    fail(`${name} 검출 건수 불일치(중복 포함): ${actual.length} != ${want.length}`);
  }
}

function checkNoFinding(name: string, findings: Finding[], lines: number[]) {
  const bad = findings.filter((f) => lines.includes(f.line));
  if (bad.length === 0) pass(`${name} 미검출 줄 확인 (${lines.join(",")})`);
  else for (const f of bad) fail(`${name} ${f.line}줄에서 검출되면 안 됨: ${f.fn}`);
}

// ---------------- JS ----------------
console.log("== sample-ws.js ==");
const js = expected.js;
const jsText = readFileSync(path.join(root, js.file), "utf8");
const lineCount = splitLines(jsText).length;
if (lineCount === js.lineCount) pass(`샘플 줄 수 ${lineCount}`);
else fail(`샘플 줄 수 ${lineCount} != ${js.lineCount}`);
if (jsText.includes("\r")) fail("sample-ws.js 에 CR 이 있음(LF 여야 함)");

const jsResult = scanSource({ fileName: "sample-ws.js", text: jsText, rules });
compare("js", jsResult.findings, js.findings);
const s = jsResult.summary;
if (
  s.total === js.summary.total &&
  s.byType.INTENT_DIFF === js.summary.INTENT_DIFF &&
  s.byType.REPLACE === js.summary.REPLACE &&
  s.byType.UNSUPPORTED === js.summary.UNSUPPORTED
) {
  pass(`요약 총 ${s.total} / 의도 다름 ${s.byType.INTENT_DIFF} / 단순 치환 ${s.byType.REPLACE} / 미지원 ${s.byType.UNSUPPORTED}`);
} else {
  fail(`요약 불일치: ${JSON.stringify(s)}`);
}
checkNoFinding("js", jsResult.findings, js.noFindingLines);
for (const { line, fn } of js.noFindingFnOnLine) {
  if (jsResult.findings.some((f) => f.line === line && f.fn === fn)) fail(`js ${line}줄 ${fn} 는 주석 안이라 검출되면 안 됨`);
  else pass(`js ${line}줄 뒤쪽 주석의 ${fn} 미검출`);
}
for (const { line, count } of js.candidateCounts) {
  const list = jsResult.findings.filter((f) => f.line === line);
  if (list.length === count && list.every((f) => f.candidateCount === count)) pass(`js ${line}줄 후보 ${count}개`);
  else fail(`js ${line}줄 후보 수 불일치`);
}

// INTENT_DIFF / UNSUPPORTED 는 변경 요청으로 만들어질 수 없어야 한다.
const unchangeable = jsResult.findings.filter((f) => f.ruleType !== "REPLACE" && !f.edit);
if (unchangeable.every((f) => toChangeRequest(f) === null)) pass("INTENT_DIFF·UNSUPPORTED 는 변경 요청 생성 불가");
else fail("INTENT_DIFF/UNSUPPORTED 에서 변경 요청이 만들어짐");

// ---- 변경 (12.4) ----
const ch = js.change;
const f41 = jsResult.findings.find((f) => f.line === 41 && f.fn === "demoGetCol");
const f17 = jsResult.findings.find((f) => f.line === 17 && f.fn === "demoSetCol");
if (!f41 || !f17) {
  fail("변경 시험 대상(17, 41줄) 항목이 없음");
} else {
  const req41 = toChangeRequest(f41)!;
  const preview = previewChange(jsText, req41);
  if (preview.before === 'var y = dma_form.demoGetCol(0, "NAME");' && preview.after === ch.line41After) pass("41줄 미리보기 전/후");
  else fail(`41줄 미리보기 불일치: ${JSON.stringify(preview)}`);

  const fixed41 = applyChangeRequests(jsText, [req41]);
  const a = splitLines(jsText);
  const b = splitLines(fixed41);
  const diffLines = a.map((_, i) => i).filter((i) => a[i] !== b[i]).map((i) => i + 1);
  if (b.length === 41 && diffLines.join() === "41" && b[40] === ch.line41After) pass("41줄 변경: 줄 수 41 유지, 41줄만 변경");
  else fail(`41줄 변경 결과 불일치 (변경된 줄: ${diffLines.join()})`);
  const rescan41 = scanSource({ fileName: "sample-ws.js", text: fixed41, rules });
  if (rescan41.summary.total === ch.rescanTotalAfterLine41) pass(`41줄 적용 후 재스캔 ${rescan41.summary.total}건`);
  else fail(`41줄 적용 후 재스캔 ${rescan41.summary.total}건 != ${ch.rescanTotalAfterLine41}`);

  const bulk = buildBulkItems(jsResult.findings);
  const bulkLines = (pred: (i: (typeof bulk)[number]) => boolean) =>
    [...new Set(bulk.filter(pred).map((i) => i.finding.line))].sort((x, y) => x - y).join();
  if (bulk.every((i) => i.finding.ruleType === "REPLACE")) pass("일괄 변경 목록은 REPLACE 항목만");
  else fail("일괄 변경 목록에 REPLACE 가 아닌 항목이 있음");
  if (bulkLines((i) => i.defaultChecked) === ch.bulkDefaultCheckedLines.join()) pass("일괄 변경 기본 체크 = 41줄");
  else fail(`일괄 변경 기본 체크 불일치: ${bulkLines((i) => i.defaultChecked)}`);
  if (bulkLines((i) => !i.excluded && !i.defaultChecked) === ch.bulkUncheckedLines.join()) pass("일괄 변경 미체크 = 17줄");
  else fail(`일괄 변경 미체크 불일치: ${bulkLines((i) => !i.excluded && !i.defaultChecked)}`);
  if (bulkLines((i) => i.excluded) === ch.bulkExcludedLines.join()) pass("일괄 변경 제외 = 11, 35, 36줄");
  else fail(`일괄 변경 제외 불일치: ${bulkLines((i) => i.excluded)}`);

  const fixedBoth = applyChangeRequests(jsText, [toChangeRequest(f17)!, req41]);
  const c = splitLines(fixedBoth);
  const diffBoth = a.map((_, i) => i).filter((i) => a[i] !== c[i]).map((i) => i + 1);
  if (c.length === 41 && diffBoth.join() === "17,41" && c[16] === ch.line17After && c[40] === ch.line41After) {
    pass("17·41줄 변경: 두 줄만 바뀌고 17줄 뒤쪽 주석 불변");
  } else fail(`17·41줄 변경 결과 불일치 (변경된 줄: ${diffBoth.join()})`);
  const rescanBoth = scanSource({ fileName: "sample-ws.js", text: fixedBoth, rules });
  if (rescanBoth.summary.total === ch.rescanTotalAfterLines17and41) pass(`17·41줄 적용 후 재스캔 ${rescanBoth.summary.total}건`);
  else fail(`17·41줄 적용 후 재스캔 ${rescanBoth.summary.total}건 != ${ch.rescanTotalAfterLines17and41}`);

  // CRLF 보존
  const crlf = jsText.replace(/\n/g, "\r\n");
  const crlfResult = scanSource({ fileName: "sample-ws.js", text: crlf, rules });
  const crlfFixed = applyChangeRequests(
    crlf,
    crlfResult.findings.filter((f) => f.line === 41 && f.changeable).map((f) => toChangeRequest(f)!),
  );
  if (crlfResult.summary.total === js.summary.total && crlfFixed.split("\r\n").length === crlf.split("\r\n").length && !/[^\r]\n/.test(crlfFixed)) {
    pass("CRLF 파일: 검출 15건 동일, 변경 후에도 CRLF 유지");
  } else fail("CRLF 파일 처리 불일치");
}

// ---------------- XML ----------------
console.log("== sample-ws.xml ==");
const xml = expected.xml;
const xmlText = readFileSync(path.join(root, xml.file), "utf8");
if (splitLines(xmlText).length === xml.lineCount) pass(`샘플 줄 수 ${xml.lineCount}`);
else fail("xml 샘플 줄 수 불일치");
const xmlResult = scanSource({ fileName: "sample-ws.xml", text: xmlText, rules });
compare("xml", xmlResult.findings, xml.findings);
checkNoFinding("xml", xmlResult.findings, xml.noFindingLines);

// ---------------- 일반 시험 ----------------
console.log("== 추가 시험 ==");
const marker = scanSource({
  fileName: "t.js",
  text: '// x.getRowCount()\nvar a = "x.getRowCount()";\n/* x.getRowCount() */\nx.getRowCount();\n',
  rules,
});
if (marker.findings.length === 1 && marker.findings[0].line === 4) pass("주석·문자열 안 호출은 미검출, 실제 호출만 검출");
else fail(`주석/문자열 시험 실패: ${marker.findings.map((f) => f.line).join()}`);
const oneLine = "x.demoNewFn9();\n";
const before = scanSource({ fileName: "t.js", text: oneLine, rules });
const added: Rule = {
  id: "00000000-0000-4000-8000-000000000001",
  nexaFn: "demoNewFn9",
  wsFn: "demoNewFn10",
  ruleType: "REPLACE",
  targetType: null,
  intentNote: null,
  exampleBefore: null,
  exampleAfter: null,
  source: "check",
  status: "PROPOSED",
  author: "check",
  verifiedBy: null,
  createdAt: "2026-09-19T00:00:00.000Z",
  updatedAt: "2026-09-19T00:00:00.000Z",
  deletedAt: null,
  deleteReason: null,
};
const after = scanSource({ fileName: "t.js", text: oneLine, rules: [...rules, added] });
if (before.findings.length === 0 && after.findings.length === 1 && after.findings[0].confidence === "CHECK") {
  pass("규칙은 인자로만 반영됨: 규칙 추가 전 0건 → 추가 후 1건(가능성 있음, 확인 필요)");
} else fail("규칙 인자 반영 시험 실패");
const none = scanSource({ fileName: "t.js", text: oneLine, rules: [] });
if (none.findings.length === 0) pass("규칙 0건이면 검출 0건");
else fail("규칙 0건인데 검출됨");

console.log(failures === 0 ? "\n결과: 전부 일치 (종료 코드 0)" : `\n결과: 실패 ${failures}건 (종료 코드 1)`);
process.exit(failures === 0 ? 0 : 1);
