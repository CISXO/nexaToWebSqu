import { handleError, json, readJsonBody } from "@/lib/api/http";
import { getRepository } from "@/lib/repository";
import { NotFoundError, ValidationError } from "@/lib/rules/errors";
import { UUID_RE, validateStatusUpdate } from "@/lib/rules/validate";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request, ctx: RouteContext<"/api/rules/[id]/status">) {
  try {
    const { id } = await ctx.params;
    if (!UUID_RE.test(id)) throw new NotFoundError();
    const body = await readJsonBody(request);
    const checked = validateStatusUpdate(body);
    if (!checked.ok) throw new ValidationError(checked.fields);
    const { status, verifiedBy, source } = checked.value;
    const rule = await getRepository().updateStatus(id, status, verifiedBy, source);
    return json({ ok: true, rule });
  } catch (e) {
    return handleError(e);
  }
}
