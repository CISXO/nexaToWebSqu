import { handleError, json } from "@/lib/api/http";
import { getRepository, getStorageKind } from "@/lib/repository";

export const dynamic = "force-dynamic";

export async function GET() {
  let storage: "local" | "oracle" | undefined;
  try {
    storage = getStorageKind();
    const ruleCount = await getRepository().count();
    return json({ ok: true, storage, ruleCount });
  } catch (e) {
    return handleError(e, storage ? { storage } : {});
  }
}
