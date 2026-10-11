import { handleError, json, readJsonBody } from "@/lib/api/http";
import { getRepository } from "@/lib/repository";
import { NotFoundError, ValidationError } from "@/lib/rules/errors";
import { UUID_RE, validateDeletion } from "@/lib/rules/validate";

export const dynamic = "force-dynamic";

/** 삭제(숨김)/복원. 실제 행은 지우지 않는다 — deletedAt/deleteReason 만 바꾼다. */
export async function PATCH(request: Request, ctx: RouteContext<"/api/rules/[id]/deletion">) {
  try {
    const { id } = await ctx.params;
    if (!UUID_RE.test(id)) throw new NotFoundError();
    const body = await readJsonBody(request);
    const checked = validateDeletion(body);
    if (!checked.ok) throw new ValidationError(checked.fields);
    const { deleted, reason } = checked.value;
    const rule = await getRepository().setDeleted(id, deleted, reason);
    return json({ ok: true, rule });
  } catch (e) {
    return handleError(e);
  }
}
