// 규칙 입력 정규화·검증 (순수 함수). 클라이언트 폼과 서버 API·어댑터가 같은 함수를 쓴다.

import {
  RULE_STATUSES,
  RULE_TYPES,
  type RuleInput,
  type RuleStatus,
  type RuleType,
} from "./types";

export const IDENTIFIER_RE = /^[A-Za-z_$][A-Za-z0-9_$]*$/;
export const TARGET_TYPE_RE = /^[A-Za-z][A-Za-z0-9_]*$/;
export const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export const LIMITS = {
  fn: 100,
  targetType: 40,
  intentNote: 2000,
  example: 5000,
  source: 500,
  person: 50,
  deleteReason: 500,
} as const;

/** 앞뒤 공백 제거 후 빈 문자열이면 null. 문자열이 아닌 값(null/undefined 포함)은 null. */
export function normalizeText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

export type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; fields: Record<string, string> };

export function isRuleType(v: unknown): v is RuleType {
  return typeof v === "string" && (RULE_TYPES as readonly string[]).includes(v);
}

export function isRuleStatus(v: unknown): v is RuleStatus {
  return typeof v === "string" && (RULE_STATUSES as readonly string[]).includes(v);
}

/** 문자열이 아닌 값이 들어온 경우를 잡는다(null/undefined 는 허용 = 미입력). */
function typeCheck(
  raw: Record<string, unknown>,
  names: string[],
  fields: Record<string, string>,
) {
  for (const n of names) {
    const v = raw[n];
    if (v !== undefined && v !== null && typeof v !== "string") {
      fields[n] = "문자열이어야 합니다.";
    }
  }
}

/**
 * 규칙 등록 입력 검증. 알 수 없는 필드(id, status, createdAt 등)는 무시한다.
 * 필수·선택 규칙은 plan.md §5.1, §8.4.
 */
export function validateRuleInput(raw: unknown): ValidationResult<RuleInput> {
  const fields: Record<string, string> = {};
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return { ok: false, fields: { _body: "요청 본문은 JSON 객체여야 합니다." } };
  }
  const r = raw as Record<string, unknown>;
  typeCheck(
    r,
    [
      "nexaFn",
      "wsFn",
      "ruleType",
      "targetType",
      "intentNote",
      "exampleBefore",
      "exampleAfter",
      "source",
      "author",
    ],
    fields,
  );

  const nexaFn = normalizeText(r.nexaFn);
  const wsFn = normalizeText(r.wsFn);
  const targetType = normalizeText(r.targetType);
  const intentNote = normalizeText(r.intentNote);
  const exampleBefore = normalizeText(r.exampleBefore);
  const exampleAfter = normalizeText(r.exampleAfter);
  const source = normalizeText(r.source);
  const author = normalizeText(r.author);
  const ruleTypeRaw = typeof r.ruleType === "string" ? r.ruleType.trim() : null;

  let ruleType: RuleType | null = null;
  if (!fields.ruleType) {
    if (!ruleTypeRaw) fields.ruleType = "유형을 선택하세요";
    else if (!isRuleType(ruleTypeRaw)) fields.ruleType = "유형 값이 올바르지 않습니다.";
    else ruleType = ruleTypeRaw;
  }

  if (!fields.nexaFn) {
    if (!nexaFn) fields.nexaFn = "넥사크로 함수명을 입력하세요";
    else if (nexaFn.length > LIMITS.fn) fields.nexaFn = "100자 이하로 입력하세요";
    else if (!IDENTIFIER_RE.test(nexaFn)) fields.nexaFn = "식별자 형식이 아닙니다";
  }

  if (!fields.wsFn) {
    if (wsFn) {
      if (wsFn.length > LIMITS.fn) fields.wsFn = "100자 이하로 입력하세요";
      else if (!IDENTIFIER_RE.test(wsFn)) fields.wsFn = "식별자 형식이 아닙니다";
      else if (ruleType === "REPLACE" && wsFn === nexaFn)
        fields.wsFn = "넥사크로 함수명과 달라야 합니다";
    } else if (ruleType === "REPLACE" || ruleType === "INTENT_DIFF") {
      fields.wsFn = "대체 함수를 입력하세요";
    }
  }

  if (!fields.targetType && targetType) {
    if (targetType.length > LIMITS.targetType || !TARGET_TYPE_RE.test(targetType))
      fields.targetType = "영문/숫자/밑줄만, 40자 이하";
  }

  if (!fields.intentNote) {
    if (intentNote && intentNote.length > LIMITS.intentNote)
      fields.intentNote = "2,000자 이하로 입력하세요";
    else if (!intentNote && (ruleType === "INTENT_DIFF" || ruleType === "UNSUPPORTED"))
      fields.intentNote = "설명을 입력하세요";
  }

  if (!fields.exampleBefore && exampleBefore && exampleBefore.length > LIMITS.example)
    fields.exampleBefore = "5,000자 이하";
  if (!fields.exampleAfter && exampleAfter && exampleAfter.length > LIMITS.example)
    fields.exampleAfter = "5,000자 이하";

  if (!fields.source) {
    if (!source) fields.source = "출처를 입력하세요";
    else if (source.length > LIMITS.source) fields.source = "500자 이하로 입력하세요";
  }

  if (!fields.author) {
    if (!author) fields.author = "등록자를 입력하세요";
    else if (author.length > LIMITS.person) fields.author = "50자 이하로 입력하세요";
  }

  if (Object.keys(fields).length > 0 || ruleType === null || !nexaFn || !source || !author) {
    return { ok: false, fields };
  }
  return {
    ok: true,
    value: {
      nexaFn,
      wsFn,
      ruleType,
      targetType,
      intentNote,
      exampleBefore,
      exampleAfter,
      source,
      author,
    },
  };
}

export interface StatusUpdateInput {
  status: RuleStatus;
  verifiedBy: string | null;
  source: string | null;
}

export interface DeletionInput {
  deleted: boolean;
  reason: string | null;
}

/** 삭제/복원 입력 검증. 삭제(deleted=true)는 이유 필수, 복원은 이유를 null 로 만든다. */
export function validateDeletion(raw: unknown): ValidationResult<DeletionInput> {
  const fields: Record<string, string> = {};
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return { ok: false, fields: { _body: "요청 본문은 JSON 객체여야 합니다." } };
  }
  const r = raw as Record<string, unknown>;
  typeCheck(r, ["reason"], fields);
  if (typeof r.deleted !== "boolean") fields.deleted = "삭제 여부(true/false)가 필요합니다.";

  const reason = normalizeText(r.reason);
  if (!fields.reason && r.deleted === true) {
    if (!reason) fields.reason = "삭제 이유를 입력하세요";
    else if (reason.length > LIMITS.deleteReason) fields.reason = "500자 이하로 입력하세요";
  }

  if (Object.keys(fields).length > 0 || typeof r.deleted !== "boolean") return { ok: false, fields };
  return { ok: true, value: { deleted: r.deleted, reason: r.deleted ? reason : null } };
}

/** 상태 변경 입력 검증. VERIFIED 는 verifiedBy 필수, PROPOSED 는 verifiedBy 를 null 로 만든다. */
export function validateStatusUpdate(raw: unknown): ValidationResult<StatusUpdateInput> {
  const fields: Record<string, string> = {};
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return { ok: false, fields: { _body: "요청 본문은 JSON 객체여야 합니다." } };
  }
  const r = raw as Record<string, unknown>;
  typeCheck(r, ["status", "verifiedBy", "source"], fields);

  const statusRaw = typeof r.status === "string" ? r.status.trim() : null;
  let status: RuleStatus | null = null;
  if (!fields.status) {
    if (!statusRaw) fields.status = "상태를 선택하세요";
    else if (!isRuleStatus(statusRaw)) fields.status = "상태 값이 올바르지 않습니다.";
    else status = statusRaw;
  }
  const verifiedBy = normalizeText(r.verifiedBy);
  const source = normalizeText(r.source);

  if (!fields.verifiedBy) {
    if (status === "VERIFIED" && !verifiedBy) fields.verifiedBy = "검증자 이름을 입력하세요";
    else if (verifiedBy && verifiedBy.length > LIMITS.person)
      fields.verifiedBy = "50자 이하로 입력하세요";
  }
  if (!fields.source && source && source.length > LIMITS.source)
    fields.source = "500자 이하로 입력하세요";

  if (Object.keys(fields).length > 0 || status === null) return { ok: false, fields };
  return {
    ok: true,
    value: {
      status,
      verifiedBy: status === "VERIFIED" ? verifiedBy : null,
      source,
    },
  };
}
