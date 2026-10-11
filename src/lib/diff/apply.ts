// 변경(치환) 로직 (순수 함수). plan.md §7.
// 변경 가능한 것은 REPLACE 유형의 넥사크로 이름 호출(changeable)과, 스캐너가 만든 인자 변경 후보(edit) 뿐이다.
// 그 외 INTENT_DIFF · UNSUPPORTED 를 "자동으로" 치환하는 경로는 이 모듈에 존재하지 않는다:
// 자동 치환 함수는 toChangeRequest() 가 만든 요청만 받고, toChangeRequest() 는 changeable 이 아니면 null 을 준다.
// 변경 불가 항목은 previewLineEdit() 로 원문 줄을 그대로 보여 주고, 사용자가 직접 고친 줄만 applyLineEdit() 로 적용한다.

import { computeLineStarts, lineRange } from "../scanner/lines";
import type { ArgEdit, Finding } from "../scanner/types";

export class StaleChangeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StaleChangeError";
  }
}

/** 함수명 토큰 1개를 바꾸는 요청. Finding 에서만 만들 수 있다(toChangeRequest). */
export interface ChangeRequest {
  offset: number;
  length: number;
  expected: string;
  replacement: string;
  line: number;
  column: number;
}

/**
 * REPLACE + NEXA 면이고 대체 함수가 있는 결과만 변경 요청으로 바꾼다.
 * 예외: 스캐너가 만든 인자 변경 후보(f.edit, 콜백 인자 점검)는 그 인자 구간 1개만 바꾸는 요청이 된다.
 * 그 외에는 null.
 */
export function toChangeRequest(f: Finding): ChangeRequest | null {
  if (f.changeable && f.edit) {
    return {
      offset: f.edit.offset,
      length: f.edit.length,
      expected: f.edit.expected,
      replacement: f.edit.replacement,
      line: f.line,
      column: f.edit.column,
    };
  }
  if (!f.changeable || f.ruleType !== "REPLACE" || f.side !== "NEXA" || !f.replacement) {
    return null;
  }
  return {
    offset: f.offset,
    length: f.length,
    expected: f.fn,
    replacement: f.replacement,
    line: f.line,
    column: f.column,
  };
}

export interface LinePreview {
  line: number;
  column: number;
  before: string;
  after: string;
}

/** 변경 전/후 줄 미리보기. 현재 텍스트의 해당 위치가 요청과 다르면 StaleChangeError. */
export function previewChange(text: string, req: ChangeRequest): LinePreview {
  assertTokenAt(text, req);
  const starts = computeLineStarts(text);
  const range = lineRange(text, starts, req.line);
  if (!range) throw new StaleChangeError("대상 줄을 찾을 수 없습니다.");
  const before = text.slice(range.start, range.end);
  const rel = req.offset - range.start;
  const after = before.slice(0, rel) + req.replacement + before.slice(rel + req.length);
  return { line: req.line, column: req.column, before, after };
}

/**
 * 직접 수정용 미리보기: 자동 치환 없이 원문 줄을 before/after 양쪽에 그대로 담는다.
 * 검출 위치의 함수명이 현재 텍스트와 다르면 StaleChangeError.
 */
export function previewLineEdit(text: string, f: Finding): LinePreview {
  assertTokenAt(text, { offset: f.offset, length: f.length, expected: f.fn });
  const range = lineRange(text, computeLineStarts(text), f.line);
  if (!range) throw new StaleChangeError("대상 줄을 찾을 수 없습니다.");
  const before = text.slice(range.start, range.end);
  return { line: f.line, column: f.column, before, after: before };
}

function assertTokenAt(text: string, req: Pick<ChangeRequest, "offset" | "length" | "expected">): void {
  if (text.slice(req.offset, req.offset + req.length) !== req.expected) {
    throw new StaleChangeError(
      "소스가 미리보기 이후 바뀌어 적용할 수 없습니다. 다시 스캔한 뒤 시도하세요.",
    );
  }
}

/**
 * 여러 토큰 치환(일괄 변경). 열 번호(오프셋) 내림차순으로 적용해 위치가 밀리지 않는다.
 * 줄 수·다른 문자는 바뀌지 않는다.
 */
export function applyChangeRequests(text: string, requests: ChangeRequest[]): string {
  const sorted = [...requests].sort((a, b) => b.offset - a.offset);
  let prevStart = Infinity;
  let out = text;
  for (const req of sorted) {
    if (req.offset + req.length > prevStart) {
      throw new StaleChangeError("치환 위치가 겹칩니다.");
    }
    assertTokenAt(out, req);
    out = out.slice(0, req.offset) + req.replacement + out.slice(req.offset + req.length);
    prevStart = req.offset;
  }
  return out;
}

/**
 * 개별 변경 적용: 사용자가 편집한 "변경 후 줄" 전체로 그 줄을 교체한다.
 * - 줄바꿈 입력 거부 (줄 번호 유지, E3-3)
 * - 적용 전 현재 줄이 미리보기 당시 줄(expectedBefore)과 다르면 거부 (E3-5)
 */
export function applyLineEdit(
  text: string,
  line: number,
  expectedBefore: string,
  newLine: string,
): string {
  if (/[\r\n]/.test(newLine)) {
    throw new StaleChangeError("변경 후 줄에는 줄바꿈을 넣을 수 없습니다.");
  }
  const starts = computeLineStarts(text);
  const range = lineRange(text, starts, line);
  if (!range || text.slice(range.start, range.end) !== expectedBefore) {
    throw new StaleChangeError(
      "소스가 미리보기 이후 바뀌어 적용할 수 없습니다. 다시 스캔한 뒤 시도하세요.",
    );
  }
  return text.slice(0, range.start) + newLine + text.slice(range.end);
}

/**
 * 1안/2안 버튼용: 원문 줄(before)에 인자 후보 1개를 적용한 줄. 위치가 맞지 않으면 null.
 * 결과 줄은 직접 수정 칸에 채워지고, 적용은 applyLineEdit() 로 한다.
 */
export function applyPresetToLine(before: string, preset: ArgEdit): string | null {
  const col = preset.column - 1;
  if (before.slice(col, col + preset.length) !== preset.expected) return null;
  return before.slice(0, col) + preset.replacement + before.slice(col + preset.length);
}

/** 버튼 이름: label 의 앞부분 (예: "1안 명시형") */
export function presetName(preset: ArgEdit): string {
  const i = preset.label.indexOf(":");
  return i > 0 ? preset.label.slice(0, i) : preset.label;
}

/** 다운로드 파일명: {원본이름}.fixed{.확장자} */
export function fixedFileName(fileName: string): string {
  const idx = fileName.lastIndexOf(".");
  if (idx <= 0) return `${fileName}.fixed`;
  return `${fileName.slice(0, idx)}.fixed${fileName.slice(idx)}`;
}

export interface BulkItem {
  finding: Finding;
  /** 후보가 2개 이상인 호출: 일괄 변경에서 제외(개별 변경만 가능, D8) */
  excluded: boolean;
  /** 기본 체크: 후보 1개 + 타입 지정(TYPED) 규칙만 (D9) */
  defaultChecked: boolean;
}

/** 일괄 변경 목록: REPLACE(변경 가능) 항목만 나열한다. INTENT_DIFF·UNSUPPORTED 는 여기에 나타나지 않는다. */
export function buildBulkItems(findings: Finding[]): BulkItem[] {
  return findings
    .filter((f) => toChangeRequest(f) !== null)
    .map((finding) => {
      const excluded = finding.candidateCount > 1;
      return {
        finding,
        excluded,
        defaultChecked: !excluded && finding.confidence === "TYPED",
      };
    });
}
