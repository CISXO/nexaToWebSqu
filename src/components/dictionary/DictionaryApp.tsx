"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { ApiClientError, deleteRule, errorMessage, fetchRules, updateRuleStatus } from "@/lib/client/api";
import {
  RULE_TYPE_LABEL,
  RULE_TYPES,
  type Rule,
  type RuleFilter,
  type RuleStatus,
  type RuleType,
} from "@/lib/rules/types";
import { Banner, StatusBadge, TypeBadge, btn, btnPrimary } from "../ui";
import { useToast } from "../Toast";

interface Loaded {
  key: string;
  rules?: Rule[];
  error?: string;
}

const selectCls = "rounded border border-slate-300 bg-white px-2 py-1.5 text-sm";

function formatDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("ko-KR");
}

export default function DictionaryApp({
  initialQuery,
  justCreated,
}: {
  initialQuery: string;
  justCreated: boolean;
}) {
  const [qInput, setQInput] = useState(initialQuery);
  const [q, setQ] = useState(initialQuery);
  const [ruleType, setRuleType] = useState<"" | RuleType>("");
  const [status, setStatus] = useState<"" | RuleStatus>("");
  const [targetType, setTargetType] = useState("");
  const [reload, setReload] = useState(0);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const key = JSON.stringify([q, ruleType, status, targetType, reload]);

  // 규칙 등록 직후 이동해 오면 완료 토스트를 한 번만 띄우고, 새로고침 때 다시 뜨지 않게 주소에서 created 를 뺀다.
  const toast = useToast();
  const announced = useRef(false);
  useEffect(() => {
    if (!justCreated || announced.current) return;
    announced.current = true;
    toast('등록되었습니다. 방금 등록한 규칙은 상태 "제안됨"으로 표시됩니다.');
    const url = new URL(window.location.href);
    url.searchParams.delete("created");
    window.history.replaceState(window.history.state, "", url);
  }, [justCreated, toast]);

  // 검색어 입력 후 잠시 멈추면 자동 조회 (Enter 는 즉시)
  useEffect(() => {
    if (qInput === q) return;
    const t = setTimeout(() => setQ(qInput), 250);
    return () => clearTimeout(t);
  }, [qInput, q]);

  useEffect(() => {
    const controller = new AbortController();
    const filter: RuleFilter = {};
    if (q.trim()) filter.q = q.trim();
    if (ruleType) filter.ruleType = ruleType;
    if (status) filter.status = status;
    if (targetType) filter.targetType = targetType;
    fetchRules(filter, controller.signal)
      .then((rules) => setLoaded({ key, rules }))
      .catch((e: unknown) => {
        if (e instanceof DOMException && e.name === "AbortError") return;
        setLoaded({ key, error: errorMessage(e) });
      });
    return () => controller.abort();
  }, [key, q, ruleType, status, targetType]);

  const loading = loaded?.key !== key;
  const rules = loaded?.rules ?? [];
  const selected = rules.find((r) => r.id === selectedId) ?? null;

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setQ(qInput);
  };

  return (
    <div className="mx-auto flex w-full max-w-[1600px] flex-1 flex-col gap-4 px-4 py-6">
      <div>
        <h1 className="text-xl font-bold">함수 매핑 사전</h1>
        <p className="mt-1 text-sm text-slate-600">
          넥사크로 함수와 웹스퀘어 함수의 대응 관계·전/후 예제를 찾아봅니다. 함수명은 부분 일치(대소문자 무시)이며
          양쪽 이름을 모두 검색합니다.
        </p>
      </div>

      <form onSubmit={onSubmit} role="search" className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label htmlFor="dict-q" className="text-sm font-semibold">
            함수명 검색
          </label>
          <input
            id="dict-q"
            type="search"
            value={qInput}
            onChange={(e) => setQInput(e.target.value)}
            placeholder="예: getRowCount"
            autoComplete="off"
            spellCheck={false}
            className={`${selectCls} w-64`}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="dict-type" className="text-sm font-semibold">
            유형
          </label>
          <select id="dict-type" value={ruleType} onChange={(e) => setRuleType(e.target.value as "" | RuleType)} className={selectCls}>
            <option value="">전체</option>
            {RULE_TYPES.map((t) => (
              <option key={t} value={t}>
                {RULE_TYPE_LABEL[t]}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="dict-status" className="text-sm font-semibold">
            상태
          </label>
          <select id="dict-status" value={status} onChange={(e) => setStatus(e.target.value as "" | RuleStatus)} className={selectCls}>
            <option value="">전체</option>
            <option value="PROPOSED">제안됨</option>
            <option value="VERIFIED">검증됨</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="dict-target" className="text-sm font-semibold">
            대상 타입
          </label>
          <select id="dict-target" value={targetType} onChange={(e) => setTargetType(e.target.value)} className={selectCls}>
            <option value="">전체</option>
            <option value="none">타입 미지정</option>
            <option value="dataList">dataList</option>
            <option value="dataMap">dataMap</option>
          </select>
        </div>
        <button type="submit" className={btnPrimary}>
          검색
        </button>
      </form>

      {loaded?.error && !loading ? (
        <Banner
          kind="error"
          action={
            <button type="button" className={btn} onClick={() => setReload((n) => n + 1)}>
              다시 시도
            </button>
          }
        >
          규칙을 불러오지 못했습니다: {loaded.error}
        </Banner>
      ) : null}

      <div className="grid flex-1 grid-cols-1 gap-4 xl:grid-cols-[3fr_2fr]">
        <section aria-label="검색 결과" aria-busy={loading} className="min-w-0">
          <p className="mb-2 text-sm text-slate-600" role="status">
            {loading ? "불러오는 중…" : loaded?.error ? "" : `${rules.length}건`}
          </p>
          {!loading && !loaded?.error && rules.length === 0 ? (
            <div className="rounded border border-slate-300 bg-white p-6 text-sm">
              일치하는 규칙이 없습니다.{" "}
              <Link href="/rules/new" className="text-blue-700 underline">
                [규칙 등록]
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto rounded border border-slate-300 bg-white">
              <table className="w-full min-w-[720px] text-left text-sm" data-testid="rule-table">
                <caption className="sr-only">규칙 목록</caption>
                <thead className="bg-slate-100 text-xs text-slate-700">
                  <tr>
                    <th scope="col" className="px-3 py-2">넥사크로 함수</th>
                    <th scope="col" className="px-3 py-2">웹스퀘어 함수</th>
                    <th scope="col" className="px-3 py-2">유형</th>
                    <th scope="col" className="px-3 py-2">대상 타입</th>
                    <th scope="col" className="px-3 py-2">상태</th>
                    <th scope="col" className="px-3 py-2">등록자</th>
                    <th scope="col" className="px-3 py-2">등록일</th>
                  </tr>
                </thead>
                <tbody>
                  {rules.map((r) => (
                    <tr
                      key={r.id}
                      data-rule-fn={r.nexaFn}
                      // 행 어디를 눌러도 선택된다. 텍스트를 드래그해 복사하는 중이면 무시한다. (키보드는 함수명 버튼 사용)
                      onClick={() => {
                        if (window.getSelection()?.toString()) return;
                        setSelectedId(r.id);
                      }}
                      className={`cursor-pointer border-t border-slate-200 ${
                        r.id === selectedId ? "bg-blue-50" : "hover:bg-slate-50"
                      }`}
                    >
                      <td className="px-3 py-2">
                        <button
                          type="button"
                          onClick={() => setSelectedId(r.id)}
                          aria-pressed={r.id === selectedId}
                          className="rounded font-mono font-semibold text-blue-800 underline"
                        >
                          {r.nexaFn}
                        </button>
                      </td>
                      <td className="px-3 py-2 font-mono">{r.wsFn ?? "—"}</td>
                      <td className="px-3 py-2"><TypeBadge type={r.ruleType} /></td>
                      <td className="px-3 py-2">{r.targetType ?? "타입 미지정"}</td>
                      <td className="px-3 py-2"><StatusBadge status={r.status} /></td>
                      <td className="px-3 py-2">{r.author}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{formatDate(r.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <aside aria-label="규칙 상세" className="min-w-0">
          {selected ? (
            <RuleDetail
              key={selected.id}
              rule={selected}
              onChanged={() => setReload((n) => n + 1)}
            />
          ) : (
            <div className="rounded border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-600">
              표에서 함수명을 선택하면 상세(의도 차이·전/후 예제·출처)가 여기 표시됩니다.
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

function RuleDetail({ rule, onChanged }: { rule: Rule; onChanged: () => void }) {
  const [editing, setEditing] = useState(false);
  const [verifiedBy, setVerifiedBy] = useState("");
  const [source, setSource] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<{ kind: "error" | "success"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setMessage(null);
    setErrors({});
    try {
      await updateRuleStatus(rule.id, {
        status: "VERIFIED",
        verifiedBy,
        ...(source.trim() ? { source } : {}),
      });
      toast("검증됨으로 변경되었습니다.");
      setEditing(false);
      onChanged();
    } catch (err) {
      if (err instanceof ApiClientError && err.fields) setErrors(err.fields);
      setMessage({ kind: "error", text: errorMessage(err) });
    } finally {
      setBusy(false);
    }
  };

  const revert = async () => {
    if (busy) return;
    setBusy(true);
    setMessage(null);
    try {
      await updateRuleStatus(rule.id, { status: "PROPOSED" });
      toast("제안됨으로 되돌렸습니다.");
      onChanged();
    } catch (err) {
      setMessage({ kind: "error", text: errorMessage(err) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <article className="flex flex-col gap-3 rounded border border-slate-300 bg-white p-4 text-sm" data-testid="rule-detail">
      <header className="flex flex-wrap items-center gap-2">
        <h2 className="font-mono text-base font-bold">{rule.nexaFn}</h2>
        <span aria-hidden="true">→</span>
        <span className="font-mono text-base font-bold">{rule.wsFn ?? "(대응 함수 없음)"}</span>
        <TypeBadge type={rule.ruleType} />
        <StatusBadge status={rule.status} />
        {rule.source.startsWith("REF-") ? (
          <span className="rounded border border-violet-300 bg-violet-50 px-1.5 py-0.5 text-xs text-violet-900">
            평가/시연용 가상 규칙
          </span>
        ) : null}
      </header>

      <dl className="grid grid-cols-[7rem_1fr] gap-x-3 gap-y-1">
        <dt className="text-slate-600">대상 타입</dt>
        <dd>{rule.targetType ?? "타입 미지정 (가능성 있음, 확인 필요)"}</dd>
        <dt className="text-slate-600">출처</dt>
        <dd className="break-words">{rule.source}</dd>
        <dt className="text-slate-600">등록자</dt>
        <dd>{rule.author}</dd>
        <dt className="text-slate-600">등록일</dt>
        <dd>{formatDate(rule.createdAt)}</dd>
        <dt className="text-slate-600">검증자</dt>
        <dd>{rule.verifiedBy ?? "—"}</dd>
      </dl>

      <section>
        <h3 className="font-semibold">의도 차이 설명</h3>
        <p className="mt-1 whitespace-pre-wrap">{rule.intentNote ?? "(설명 없음)"}</p>
      </section>

      <section>
        <h3 className="font-semibold">넥사크로 예제</h3>
        <pre className="mt-1 overflow-x-auto rounded border border-slate-200 bg-slate-50 p-2 font-mono text-xs">
          {rule.exampleBefore ?? "(없음)"}
        </pre>
      </section>
      <section>
        <h3 className="font-semibold">웹스퀘어 예제</h3>
        <pre className="mt-1 overflow-x-auto rounded border border-slate-200 bg-slate-50 p-2 font-mono text-xs">
          {rule.exampleAfter ?? "(없음)"}
        </pre>
      </section>

      {message ? <Banner kind={message.kind}>{message.text}</Banner> : null}

      {rule.status === "PROPOSED" ? (
        editing ? (
          <form onSubmit={submit} className="flex flex-col gap-2 rounded border border-slate-200 p-3">
            <div className="flex flex-col gap-1">
              <label htmlFor="verify-name" className="font-semibold">
                검증자 이름 <span className="text-red-700" aria-hidden="true">*</span>
                <span className="sr-only"> (필수)</span>
              </label>
              <input
                id="verify-name"
                value={verifiedBy}
                onChange={(e) => setVerifiedBy(e.target.value)}
                className="rounded border border-slate-300 px-2 py-1.5"
                aria-invalid={errors.verifiedBy ? true : undefined}
                autoComplete="name"
              />
              {errors.verifiedBy ? (
                <p role="alert" className="text-xs font-semibold text-red-700">{errors.verifiedBy}</p>
              ) : null}
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="verify-source" className="font-semibold">
                출처 갱신 (선택)
              </label>
              <input
                id="verify-source"
                value={source}
                onChange={(e) => setSource(e.target.value)}
                placeholder="확인한 공식 문서 URL·실동작 확인 내용 (입력하면 출처를 바꿉니다)"
                className="rounded border border-slate-300 px-2 py-1.5"
              />
              {errors.source ? (
                <p role="alert" className="text-xs font-semibold text-red-700">{errors.source}</p>
              ) : null}
            </div>
            <div className="flex gap-2">
              <button type="submit" className={btnPrimary} disabled={busy}>
                확인
              </button>
              <button type="button" className={btn} onClick={() => setEditing(false)} disabled={busy}>
                취소
              </button>
            </div>
          </form>
        ) : (
          <div>
            <button type="button" className={btn} onClick={() => setEditing(true)}>
              검증됨으로 변경
            </button>
          </div>
        )
      ) : (
        <div>
          <button type="button" className={btn} onClick={() => void revert()} disabled={busy}>
            제안됨으로 되돌리기
          </button>
        </div>
      )}

      <DeleteSection rule={rule} onChanged={onChanged} />
    </article>
  );
}

function DeleteSection({ rule, onChanged }: { rule: Rule; onChanged: () => void }) {
  const [editing, setEditing] = useState(false);
  const [reason, setReason] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<{ kind: "error" | "success"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setMessage(null);
    setErrors({});
    try {
      await deleteRule(rule.id, reason);
      toast("삭제 목록으로 이동했습니다.");
      setEditing(false);
      onChanged();
    } catch (err) {
      if (err instanceof ApiClientError && err.fields) setErrors(err.fields);
      setMessage({ kind: "error", text: errorMessage(err) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="border-t border-slate-200 pt-3">
      {message ? <Banner kind={message.kind}>{message.text}</Banner> : null}
      {editing ? (
        <form onSubmit={submit} className="flex flex-col gap-2 rounded border border-red-200 bg-red-50/60 p-3">
          <div className="flex flex-col gap-1">
            <label htmlFor="delete-reason" className="font-semibold">
              삭제 이유 <span className="text-red-700" aria-hidden="true">*</span>
              <span className="sr-only"> (필수)</span>
            </label>
            <input
              id="delete-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="예: 중복 등록, 잘못된 정보"
              className="rounded border border-slate-300 px-2 py-1.5"
              aria-invalid={errors.reason ? true : undefined}
            />
            {errors.reason ? (
              <p role="alert" className="text-xs font-semibold text-red-700">{errors.reason}</p>
            ) : null}
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              className="rounded border border-red-700 bg-red-700 px-3 py-1.5 text-sm font-semibold text-white hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={busy}
            >
              삭제
            </button>
            <button type="button" className={btn} onClick={() => setEditing(false)} disabled={busy}>
              취소
            </button>
          </div>
        </form>
      ) : (
        <button
          type="button"
          className="rounded border border-red-300 bg-white px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50"
          onClick={() => setEditing(true)}
        >
          삭제
        </button>
      )}
    </div>
  );
}
