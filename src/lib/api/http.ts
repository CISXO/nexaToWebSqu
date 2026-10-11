// API 공통 응답·오류 처리. 형식: { ok:true, ... } | { ok:false, error:{ code, message, fields? } } (plan.md D15)
// 요청 본문·소스는 절대 로그에 남기지 않는다. 오류 메시지에는 스택·접속 정보를 넣지 않는다.

import {
  DuplicateRuleError,
  NotFoundError,
  StorageUnavailableError,
  ValidationError,
} from "../rules/errors";
import { DUPLICATE_RULE_MESSAGE } from "../rules/types";

export const MAX_BODY_BYTES = 100 * 1024;

const NO_STORE = { "Cache-Control": "no-store" } as const;

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly fields?: Record<string, string>,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function json(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: NO_STORE });
}

export function failure(
  status: number,
  code: string,
  message: string,
  extra: Record<string, unknown> = {},
  fields?: Record<string, string>,
): Response {
  return json({ ok: false, error: { code, message, ...(fields ? { fields } : {}) }, ...extra }, status);
}

/** 오류 → 응답 변환. 예기치 않은 오류는 이름만 서버 로그에 남기고 일반 문구를 돌려준다. */
export function handleError(e: unknown, extra: Record<string, unknown> = {}): Response {
  if (e instanceof ApiError) return failure(e.status, e.code, e.message, extra, e.fields);
  if (e instanceof ValidationError) {
    return failure(400, "VALIDATION_ERROR", "입력값이 올바르지 않습니다.", extra, e.fields);
  }
  if (e instanceof DuplicateRuleError) {
    return failure(409, "DUPLICATE_RULE", DUPLICATE_RULE_MESSAGE, {
      ...extra,
      existingId: e.existingId,
    });
  }
  if (e instanceof NotFoundError) return failure(404, "NOT_FOUND", e.message, extra);
  if (e instanceof StorageUnavailableError) {
    return failure(503, "STORAGE_UNAVAILABLE", e.message, extra);
  }
  console.error("[api] 예기치 않은 오류:", e instanceof Error ? e.name : typeof e);
  return failure(500, "INTERNAL_ERROR", "서버 오류가 발생했습니다.", extra);
}

/** JSON 본문을 읽는다. 100KB 초과 → 413, 잘못된 JSON → 400. */
export async function readJsonBody(req: Request): Promise<unknown> {
  const declared = Number(req.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) {
    throw new ApiError(413, "PAYLOAD_TOO_LARGE", "요청 본문이 너무 큽니다(최대 100KB).");
  }
  const text = await req.text();
  if (Buffer.byteLength(text, "utf8") > MAX_BODY_BYTES) {
    throw new ApiError(413, "PAYLOAD_TOO_LARGE", "요청 본문이 너무 큽니다(최대 100KB).");
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new ApiError(400, "INVALID_JSON", "요청 본문이 올바른 JSON 이 아닙니다.");
  }
}
