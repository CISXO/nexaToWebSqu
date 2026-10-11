// 스캐너 코어 (순수 함수, 브라우저에서 실행). plan.md §6.
// 규칙은 인자로만 받는다 — 이 파일에는 함수명 목록이 없다(규칙 하드코딩 금지).

import { computeLineStarts, offsetToPosition } from "./lines";
import { extractScanText } from "./extract";
import { maskScript } from "./mask";
import { callbackArgPresets } from "./callbackArg";
import type { Confidence, Finding, MatchSide, ScanResult, ScanRule } from "./types";

// 수신부 . 함수명 ( — 점/옵셔널 체이닝, 공백·개행 허용. 함수명은 전체 식별자로 캡처한다.
const CALL_RE = /(\?\.|\.)(\s*)([A-Za-z_$][A-Za-z0-9_$]*)(\s*)\(/g;
const IDENT_CHAR_RE = /[A-Za-z0-9_$]/;

export interface CallSite {
  fn: string;
  receiver: string | null;
  offset: number;
}

/** 마스킹된 텍스트에서 `수신부.함수명(` 호출 위치를 모두 찾는다. */
export function findCalls(masked: string): CallSite[] {
  const calls: CallSite[] = [];
  CALL_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = CALL_RE.exec(masked)) !== null) {
    const dotIndex = m.index;
    const fnOffset = dotIndex + m[1].length + m[2].length;
    // 점 앞쪽(공백 건너뛰기)의 토큰이 수신 객체
    let k = dotIndex - 1;
    while (k >= 0 && /\s/.test(masked[k])) k--;
    if (k >= 0 && masked[k] === "." && m[1] === ".") {
      // 전개 연산자(...args(...)) 등: 호출 형태가 아니다
      continue;
    }
    let receiver: string | null = null;
    if (k >= 0 && IDENT_CHAR_RE.test(masked[k])) {
      let s = k;
      while (s > 0 && IDENT_CHAR_RE.test(masked[s - 1])) s--;
      const token = masked.slice(s, k + 1);
      if (/^[A-Za-z_$]/.test(token)) receiver = token;
    }
    calls.push({ fn: m[3], receiver, offset: fnOffset });
  }
  return calls;
}

interface Candidate {
  rule: ScanRule;
  side: MatchSide;
}

function buildIndex(rules: ScanRule[]): Map<string, Candidate[]> {
  const index = new Map<string, Candidate[]>();
  const add = (fn: string, c: Candidate) => {
    const list = index.get(fn);
    if (list) list.push(c);
    else index.set(fn, [c]);
  };
  for (const rule of rules) {
    add(rule.nexaFn, { rule, side: "NEXA" });
    // 웹스퀘어 이름 면은 INTENT_DIFF 만 (전환 후 호출의 의도 확인). nexaFn == wsFn 이면 위 NEXA 하나로 충분.
    if (rule.ruleType === "INTENT_DIFF" && rule.wsFn && rule.wsFn !== rule.nexaFn) {
      add(rule.wsFn, { rule, side: "WS" });
    }
  }
  return index;
}

function defaultReason(rule: ScanRule): string {
  if (rule.ruleType === "REPLACE") {
    return `넥사크로 ${rule.nexaFn} → 웹스퀘어 ${rule.wsFn ?? "?"} 단순 치환`;
  }
  return rule.intentNote ?? "";
}

export interface ScanInput {
  fileName: string;
  text: string;
  rules: ScanRule[];
}

export function scanSource({ fileName, text, rules }: ScanInput): ScanResult {
  const startedAt = performance.now();
  const scanText = extractScanText(fileName, text);
  const masked = maskScript(scanText);
  const starts = computeLineStarts(text);
  const index = buildIndex(rules);
  const findings: Finding[] = [];

  for (const call of findCalls(masked)) {
    const candidates = index.get(call.fn);
    if (!candidates) continue;
    const { line, column } = offsetToPosition(starts, call.offset);
    for (const { rule, side } of candidates) {
      const confidence: Confidence = rule.targetType === null ? "CHECK" : "TYPED";
      // 콜백 인자 점검(gfn_msg 등).
      // broken(함수 이름 문자열 콜백)이면 [변경] 항목, 아니면 직접 수정 항목에 1안/2안 버튼(presets)을 붙인다.
      const cbArg =
        side === "NEXA" && candidates.length === 1
          ? callbackArgPresets(scanText, masked, call.offset, call.fn)
          : { broken: false, presets: [] };
      const presets = cbArg.presets
        .filter((e) => offsetToPosition(starts, e.offset).line === line)
        .map((e) => ({ ...e, column: offsetToPosition(starts, e.offset).column }));
      if (cbArg.broken && presets.length > 0) {
        // 한 항목으로 만들고 기본값은 1안. 창 안의 1안/2안 버튼으로 바꿔 고른다.
        const e = presets[0];
        findings.push({
          id: `${call.offset}:${rule.id}:arg`,
          line,
          column,
          offset: call.offset,
          length: call.fn.length,
          fn: call.fn,
          receiver: call.receiver,
          side,
          ruleId: rule.id,
          ruleType: rule.ruleType,
          ruleStatus: rule.status,
          targetType: rule.targetType,
          confidence,
          reason: `콜백 인자 ${e.expected.replace(/^s*,/, "").trim()} 는 함수 이름 문자열이라 콜백이 불리지 않습니다. [변경]에서 1안/2안 버튼으로 고르세요.`,
          replacement: e.replacement,
          candidateCount: 1,
          changeable: true,
          edit: e,
          presets,
        });
        continue;
      }
      findings.push({
        id: `${call.offset}:${rule.id}`,
        line,
        column,
        offset: call.offset,
        length: call.fn.length,
        fn: call.fn,
        receiver: call.receiver,
        side,
        ruleId: rule.id,
        ruleType: rule.ruleType,
        ruleStatus: rule.status,
        targetType: rule.targetType,
        confidence,
        reason: rule.intentNote ?? defaultReason(rule),
        replacement: rule.wsFn,
        candidateCount: candidates.length,
        changeable: rule.ruleType === "REPLACE" && side === "NEXA",
        ...(presets.length > 0 ? { presets } : {}),
      });
    }
  }

  // 정렬: 줄, 열, 함수명, 타입 지정 규칙 우선, 규칙 식별
  findings.sort(
    (a, b) =>
      a.line - b.line ||
      a.column - b.column ||
      (a.fn < b.fn ? -1 : a.fn > b.fn ? 1 : 0) ||
      (a.confidence === b.confidence ? 0 : a.confidence === "TYPED" ? -1 : 1) ||
      (a.ruleId < b.ruleId ? -1 : a.ruleId > b.ruleId ? 1 : 0),
  );

  const byType = { REPLACE: 0, INTENT_DIFF: 0, UNSUPPORTED: 0 };
  for (const f of findings) byType[f.ruleType]++;

  return {
    fileName,
    findings,
    summary: {
      total: findings.length,
      byType,
      ruleCount: rules.length,
      lineCount: starts.length,
      elapsedMs: Math.round((performance.now() - startedAt) * 10) / 10,
    },
  };
}
