import type { Rule, RuleStatus, RuleType } from "../rules/types";

export type MatchSide = "NEXA" | "WS";
/** CHECK: 타입 미지정(가능성 있음, 확인 필요) / TYPED: 대상 타입 지정(타입 확인 필요) */
export type Confidence = "CHECK" | "TYPED";

export interface Finding {
  /** 화면 키: `${offset}:${ruleId}` */
  id: string;
  line: number;
  column: number;
  /** 원본 텍스트에서 함수명 토큰의 시작 오프셋 / 길이 (변경 시 위치 검증에 쓴다) */
  offset: number;
  length: number;
  fn: string;
  receiver: string | null;
  side: MatchSide;
  ruleId: string;
  ruleType: RuleType;
  ruleStatus: RuleStatus;
  targetType: string | null;
  confidence: Confidence;
  reason: string;
  replacement: string | null;
  /** 같은 호출(같은 위치)에 걸린 후보 규칙 수 */
  candidateCount: number;
  /** ruleType === REPLACE && side === NEXA, 또는 인자 변경 후보(edit)가 있는 경우 */
  changeable: boolean;
  /** 함수명이 아니라 인자 1개를 바꾸는 변경 후보 (callbackArg.ts). 같은 줄 안에서만 만든다. */
  edit?: ArgEdit;
  /** 직접 수정 창의 1안/2안 버튼: 누르면 변경 후 줄을 이 후보로 채운다 (callbackArg.ts) */
  presets?: ArgEdit[];
}

/** 인자 변경 후보: 원본 텍스트 [offset, offset+length) 가 expected 일 때 replacement 로 바꾼다. */
export interface ArgEdit {
  offset: number;
  length: number;
  expected: string;
  replacement: string;
  /** 1부터 */
  column: number;
  /** 화면 표시용 설명 (예: 1안 명시형: "scwin.fn_msgAfter(alertMsg)") */
  label: string;
}

export interface ScanSummary {
  total: number;
  byType: Record<RuleType, number>;
  ruleCount: number;
  lineCount: number;
  elapsedMs: number;
}

export interface ScanResult {
  fileName: string;
  findings: Finding[];
  summary: ScanSummary;
}

/** 스캐너가 규칙에서 읽는 필드만 (저장소 구현과 무관). */
export type ScanRule = Pick<
  Rule,
  "id" | "nexaFn" | "wsFn" | "ruleType" | "targetType" | "intentNote" | "status"
>;
