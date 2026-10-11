// 저장소 선택기. CVD_STORAGE = local(기본, 미설정 시) | oracle.
// ORACLE_* 변수 유무로 자동 전환하지 않는다(plan.md D3). 알 수 없는 값은 명시적 오류.

import { StorageUnavailableError } from "../rules/errors";
import { LocalRepository } from "./local";
import { OracleRepository } from "./oracle";
import type { Repository } from "./types";

export type { Repository } from "./types";

const g = globalThis as unknown as { __cvdRepos?: Partial<Record<"local" | "oracle", Repository>> };

export function getStorageKind(): "local" | "oracle" {
  const raw = process.env.CVD_STORAGE?.trim().toLowerCase();
  if (!raw || raw === "local") return "local";
  if (raw === "oracle") return "oracle";
  throw new StorageUnavailableError(
    "CVD_STORAGE 값이 올바르지 않습니다. local 또는 oracle 만 사용할 수 있습니다.",
  );
}

export function getRepository(): Repository {
  const kind = getStorageKind();
  const cache = (g.__cvdRepos ??= {});
  if (!cache[kind]) {
    cache[kind] = kind === "oracle" ? new OracleRepository() : new LocalRepository();
  }
  return cache[kind] as Repository;
}
