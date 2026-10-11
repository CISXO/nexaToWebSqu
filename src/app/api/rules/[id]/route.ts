import { handleError, json } from "@/lib/api/http";
import { getRepository } from "@/lib/repository";
import { NotFoundError } from "@/lib/rules/errors";
import { UUID_RE } from "@/lib/rules/validate";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, ctx: RouteContext<"/api/rules/[id]">) {
  try {
    const { id } = await ctx.params;
    if (!UUID_RE.test(id)) throw new NotFoundError();
    const rule = await getRepository().getById(id);
    return json({ ok: true, rule });
  } catch (e) {
    return handleError(e);
  }
}
