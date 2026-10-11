"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const MENU = [
  { href: "/", label: "스캔" },
  { href: "/rules/new", label: "규칙 등록" },
  { href: "/dictionary", label: "함수 사전" },
  { href: "/dictionary/deleted", label: "삭제 목록" },
  { href: "/guide", label: "사용 방법" },
];

/** pathname 과 가장 길게 일치하는 메뉴 href 를 찾는다(예: /dictionary 와 /dictionary/deleted 가 둘 다 있을 때 겹치지 않게). */
function matchLength(href: string, pathname: string): number {
  if (href === "/") return pathname === "/" ? 0 : -1;
  if (pathname === href || pathname.startsWith(`${href}/`)) return href.length;
  return -1;
}

type Health =
  | { state: "loading" }
  | { state: "ok"; storage: "local" | "oracle"; ruleCount: number }
  | { state: "error"; storage?: "local" | "oracle" };

export default function AppHeader() {
  const pathname = usePathname();
  const [health, setHealth] = useState<Health>({ state: "loading" });

  useEffect(() => {
    let cancelled = false;
    fetch("/api/health", { cache: "no-store" })
      .then(async (res) => {
        const body = await res.json().catch(() => null);
        if (cancelled) return;
        if (res.ok && body?.ok) {
          setHealth({ state: "ok", storage: body.storage, ruleCount: body.ruleCount });
        } else {
          setHealth({ state: "error", storage: body?.storage });
        }
      })
      .catch(() => {
        if (!cancelled) setHealth({ state: "error" });
      });
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  const badge =
    health.state === "loading"
      ? "저장소 확인 중"
      : health.state === "ok"
        ? `저장소: ${health.storage === "oracle" ? "Oracle" : "로컬 JSON"} · 규칙 ${health.ruleCount}건`
        : `저장소 오류${health.storage ? ` (${health.storage === "oracle" ? "Oracle" : "로컬 JSON"})` : ""}`;

  const best = Math.max(...MENU.map((m) => matchLength(m.href, pathname)));

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
        <Link href="/" className="text-lg font-bold text-slate-900">
          전환 닥터
        </Link>
        <nav aria-label="주 메뉴" className="flex flex-wrap gap-1">
          {MENU.map((m) => {
            const active = best >= 0 && matchLength(m.href, pathname) === best;
            return (
              <Link
                key={m.href}
                href={m.href}
                aria-current={active ? "page" : undefined}
                className={`rounded px-3 py-1.5 text-sm ${
                  active
                    ? "bg-slate-900 font-semibold text-white"
                    : "text-slate-700 hover:bg-slate-100"
                }`}
              >
                {m.label}
              </Link>
            );
          })}
        </nav>
        <span
          data-testid="storage-badge"
          className={`ml-auto rounded border px-2 py-1 text-xs ${
            health.state === "error"
              ? "border-red-300 bg-red-50 text-red-800"
              : "border-slate-300 bg-slate-50 text-slate-700"
          }`}
        >
          {badge}
        </span>
      </div>
    </header>
  );
}
