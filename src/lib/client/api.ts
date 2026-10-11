// 브라우저용 API 호출 헬퍼. 규칙 API 만 호출한다 — 소스·로그 텍스트는 어떤 요청에도 실리지 않는다.

import type { Rule, RuleFilter, RuleStatus } from "../rules/types";

export class ApiClientError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status = 0,
    readonly fields?: Record<string, string>,
    readonly existingId?: string | null,
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

async function call(input: string, init?: RequestInit): Promise<Record<string, unknown>> {
  let res: Response;
  try {
    res = await fetch(input, { cache: "no-store", ...init });
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") throw e;
    throw new ApiClientError(
      "NETWORK",
      "서버에 연결할 수 없습니다. 개발 서버가 실행 중인지 확인하세요.",
    );
  }
  let body: Record<string, unknown> | null = null;
  try {
    body = (await res.json()) as Record<string, unknown>;
  } catch {
    body = null;
  }
  if (!res.ok || !body || body.ok !== true) {
    const err = (body?.error ?? null) as
      | { code?: string; message?: string; fields?: Record<string, string> }
      | null;
    throw new ApiClientError(
      err?.code ?? "HTTP_ERROR",
      err?.message ?? `요청이 실패했습니다 (HTTP ${res.status}).`,
      res.status,
      err?.fields,
      (body?.existingId as string | null | undefined) ?? null,
    );
  }
  return body;
}

export async function fetchRules(filter: RuleFilter = {}, signal?: AbortSignal): Promise<Rule[]> {
  const params = new URLSearchParams();
  if (filter.q) params.set("q", filter.q);
  if (filter.ruleType) params.set("ruleType", filter.ruleType);
  if (filter.status) params.set("status", filter.status);
  if (filter.targetType) params.set("targetType", filter.targetType);
  if (filter.deleted) params.set("deleted", "1");
  const qs = params.toString();
  const body = await call(`/api/rules${qs ? `?${qs}` : ""}`, { signal });
  return body.rules as Rule[];
}

export async function createRule(input: Record<string, unknown>): Promise<Rule> {
  const body = await call("/api/rules", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return body.rule as Rule;
}

export async function updateRuleStatus(
  id: string,
  payload: { status: RuleStatus; verifiedBy?: string; source?: string },
): Promise<Rule> {
  const body = await call(`/api/rules/${encodeURIComponent(id)}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return body.rule as Rule;
}

/** 규칙을 삭제(사전 목록에서 숨김)한다. 실제로 지우지 않고 삭제 목록으로 옮긴다. */
export async function deleteRule(id: string, reason: string): Promise<Rule> {
  const body = await call(`/api/rules/${encodeURIComponent(id)}/deletion`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ deleted: true, reason }),
  });
  return body.rule as Rule;
}

/** 삭제 목록에서 복원해 사전에 다시 노출한다. */
export async function restoreRule(id: string): Promise<Rule> {
  const body = await call(`/api/rules/${encodeURIComponent(id)}/deletion`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ deleted: false }),
  });
  return body.rule as Rule;
}

export function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : "알 수 없는 오류가 발생했습니다.";
}
