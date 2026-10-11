import { ApiError, handleError, json, readJsonBody } from "@/lib/api/http";
import { getRepository } from "@/lib/repository";
import { ValidationError } from "@/lib/rules/errors";
import type { RuleFilter } from "@/lib/rules/types";
import { isRuleStatus, isRuleType, validateRuleInput } from "@/lib/rules/validate";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const filter: RuleFilter = {};
    const q = params.get("q");
    if (q) filter.q = q.slice(0, 100);
    const ruleType = params.get("ruleType");
    if (ruleType) {
      if (!isRuleType(ruleType)) throw new ApiError(400, "BAD_QUERY", "ruleType 값이 올바르지 않습니다.");
      filter.ruleType = ruleType;
    }
    const status = params.get("status");
    if (status) {
      if (!isRuleStatus(status)) throw new ApiError(400, "BAD_QUERY", "status 값이 올바르지 않습니다.");
      filter.status = status;
    }
    const targetType = params.get("targetType");
    if (targetType) filter.targetType = targetType.slice(0, 40);
    if (params.get("deleted") === "1") filter.deleted = true;

    const rules = await getRepository().list(filter);
    return json({ ok: true, rules, total: rules.length });
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(request: Request) {
  try {
    const body = await readJsonBody(request);
    const checked = validateRuleInput(body);
    if (!checked.ok) throw new ValidationError(checked.fields);
    const rule = await getRepository().create(checked.value);
    return json({ ok: true, rule }, 201);
  } catch (e) {
    return handleError(e);
  }
}
