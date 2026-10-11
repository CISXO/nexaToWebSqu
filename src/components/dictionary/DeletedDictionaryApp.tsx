"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { errorMessage, fetchRules, restoreRule } from "@/lib/client/api";
import type { Rule } from "@/lib/rules/types";
import { Banner, TypeBadge, btn } from "../ui";
import { useToast } from "../Toast";

interface Loaded {
  rules?: Rule[];
  error?: string;
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString("ko-KR");
}

export default function DeletedDictionaryApp() {
  const [reload, setReload] = useState(0);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const toast = useToast();

  useEffect(() => {
    const controller = new AbortController();
    fetchRules({ deleted: true }, controller.signal)
      .then((rules) => setLoaded({ rules }))
      .catch((e: unknown) => {
        if (e instanceof DOMException && e.name === "AbortError") return;
        setLoaded({ error: errorMessage(e) });
      });
    return () => controller.abort();
  }, [reload]);

  const loading = loaded === null;
  const rules = loaded?.rules ?? [];

  const restore = async (id: string) => {
    if (busyId) return;
    setBusyId(id);
    try {
      await restoreRule(id);
      toast("함수 사전으로 복원되었습니다.");
      setReload((n) => n + 1);
    } catch (err) {
      toast(errorMessage(err), "error");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-[1600px] flex-1 flex-col gap-4 px-4 py-6">
      <div>
        <h1 className="text-xl font-bold">삭제 목록</h1>
        <p className="mt-1 text-sm text-slate-600">
          함수 매핑 사전에서 삭제된 규칙입니다. 실제로 지워지지 않고 여기로 옮겨지며, 언제든 복원할 수 있습니다.{" "}
          <Link href="/dictionary" className="text-blue-700 underline">
            [함수 사전으로]
          </Link>
        </p>
      </div>

      {loaded?.error ? (
        <Banner
          kind="error"
          action={
            <button type="button" className={btn} onClick={() => setReload((n) => n + 1)}>
              다시 시도
            </button>
          }
        >
          목록을 불러오지 못했습니다: {loaded.error}
        </Banner>
      ) : null}

      <p className="text-sm text-slate-600" role="status">
        {loading ? "불러오는 중…" : loaded?.error ? "" : `${rules.length}건`}
      </p>

      {!loading && !loaded?.error && rules.length === 0 ? (
        <div className="rounded border border-slate-300 bg-white p-6 text-sm">
          삭제된 규칙이 없습니다.
        </div>
      ) : (
        <div className="overflow-x-auto rounded border border-slate-300 bg-white">
          <table className="w-full min-w-[840px] text-left text-sm" data-testid="deleted-rule-table">
            <caption className="sr-only">삭제된 규칙 목록</caption>
            <thead className="bg-slate-100 text-xs text-slate-700">
              <tr>
                <th scope="col" className="px-3 py-2">넥사크로 함수</th>
                <th scope="col" className="px-3 py-2">웹스퀘어 함수</th>
                <th scope="col" className="px-3 py-2">유형</th>
                <th scope="col" className="px-3 py-2">삭제 이유</th>
                <th scope="col" className="px-3 py-2">삭제일</th>
                <th scope="col" className="px-3 py-2">
                  <span className="sr-only">복원</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rules.map((r) => (
                <tr key={r.id} className="border-t border-slate-200">
                  <td className="px-3 py-2 font-mono font-semibold">{r.nexaFn}</td>
                  <td className="px-3 py-2 font-mono">{r.wsFn ?? "—"}</td>
                  <td className="px-3 py-2"><TypeBadge type={r.ruleType} /></td>
                  <td className="max-w-[20rem] break-words px-3 py-2">{r.deleteReason ?? "—"}</td>
                  <td className="whitespace-nowrap px-3 py-2">
                    {r.deletedAt ? formatDateTime(r.deletedAt) : "—"}
                  </td>
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      className={btn}
                      onClick={() => void restore(r.id)}
                      disabled={busyId === r.id}
                    >
                      복원
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
