// 규칙(Rule) 도메인 타입. 서버·클라이언트·스캐너가 공용으로 쓴다 (Node 전용 모듈 import 금지).

export const RULE_TYPES = ["REPLACE", "INTENT_DIFF", "UNSUPPORTED"] as const;
export type RuleType = (typeof RULE_TYPES)[number];

export const RULE_STATUSES = ["PROPOSED", "VERIFIED"] as const;
export type RuleStatus = (typeof RULE_STATUSES)[number];

export const RULE_TYPE_LABEL: Record<RuleType, string> = {
  REPLACE: "단순 치환",
  INTENT_DIFF: "의도 다름",
  UNSUPPORTED: "미지원",
};

export const RULE_STATUS_LABEL: Record<RuleStatus, string> = {
  PROPOSED: "제안됨",
  VERIFIED: "검증됨",
};

/** 저장된 규칙 1건. 시각은 UTC ISO 8601 문자열. */
export interface Rule {
  id: string;
  nexaFn: string;
  wsFn: string | null;
  ruleType: RuleType;
  targetType: string | null;
  intentNote: string | null;
  exampleBefore: string | null;
  exampleAfter: string | null;
  source: string;
  status: RuleStatus;
  author: string;
  verifiedBy: string | null;
  createdAt: string;
  updatedAt: string;
  /** 삭제(숨김) 시각. null 이면 사전에 노출 중. 실제 행은 지우지 않는다. */
  deletedAt: string | null;
  /** 삭제 이유. deletedAt 이 있을 때만 값이 있다. */
  deleteReason: string | null;
}

/** 등록 입력(검증·정규화를 통과한 값). id·status·시각은 저장소가 채운다. */
export interface RuleInput {
  nexaFn: string;
  wsFn: string | null;
  ruleType: RuleType;
  targetType: string | null;
  intentNote: string | null;
  exampleBefore: string | null;
  exampleAfter: string | null;
  source: string;
  author: string;
}

/**
 * 목록 조회 필터. targetType 은 값 또는 "none"(타입 미지정).
 * deleted: 생략/false → 삭제되지 않은 규칙만, true → 삭제된 규칙만.
 */
export interface RuleFilter {
  q?: string;
  ruleType?: RuleType;
  status?: RuleStatus;
  targetType?: string;
  deleted?: boolean;
}

export const DUPLICATE_RULE_MESSAGE =
  "이미 같은 함수명과 대상 객체 타입으로 등록된 규칙이 있습니다. 함수 매핑 사전 또는 삭제 목록에서 확인하세요.";

/** 유일성 키: (nexaFn, targetType 또는 센티널 '*') */
export function ruleKey(nexaFn: string, targetType: string | null): string {
  return `${nexaFn}\u0000${targetType ?? "*"}`;
}
