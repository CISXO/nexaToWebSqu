import { promises as fs } from "node:fs";
import path from "node:path";
import { failure, handleError, json } from "@/lib/api/http";
import { StorageUnavailableError } from "@/lib/rules/errors";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const file = path.join(process.cwd(), "data", "recipes.json");
    let text: string;
    try {
      text = await fs.readFile(file, "utf8");
    } catch {
      throw new StorageUnavailableError("레시피 파일(data/recipes.json)을 읽을 수 없습니다.");
    }
    let parsed: { recipes?: unknown };
    try {
      parsed = JSON.parse(text) as { recipes?: unknown };
    } catch {
      return failure(503, "STORAGE_UNAVAILABLE", "레시피 파일이 손상되었습니다(JSON 해석 실패).");
    }
    if (!Array.isArray(parsed.recipes)) {
      return failure(503, "STORAGE_UNAVAILABLE", "레시피 파일 형식이 올바르지 않습니다.");
    }
    return json({ ok: true, recipes: parsed.recipes });
  } catch (e) {
    return handleError(e);
  }
}
