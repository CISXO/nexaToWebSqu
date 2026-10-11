"use client";

import type { Finding } from "@/lib/scanner/types";
import { ConfidenceBadge, StatusBadge, TypeBadge, btn } from "../ui";

function callLabel(f: Finding): string {
  return `${f.receiver ?? "(표현식)"}.${f.fn}`;
}

export default function FindingList({
  findings,
  activeId,
  onSelect,
  onChange,
}: {
  findings: Finding[];
  activeId: string | null;
  onSelect: (f: Finding) => void;
  onChange: (f: Finding) => void;
}) {
  return (
    <ul className="flex flex-col gap-2" data-testid="finding-list">
      {findings.map((f) => {
        const active = f.id === activeId;
        return (
          <li
            key={f.id}
            data-finding-line={f.line}
            data-finding-fn={f.fn}
            data-finding-type={f.ruleType}
            data-finding-confidence={f.confidence}
            data-finding-side={f.side}
            className={`rounded border bg-white ${
              active ? "border-blue-500 ring-2 ring-blue-300" : "border-slate-300"
            }`}
          >
            <button
              type="button"
              onClick={() => onSelect(f)}
              aria-current={active ? "true" : undefined}
              className="block w-full rounded-t px-3 py-2 text-left hover:bg-slate-50"
            >
              <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="font-mono text-sm font-bold text-slate-900">{f.line}줄</span>
                <code className="break-all text-sm text-slate-900">{callLabel(f)}</code>
                <TypeBadge type={f.ruleType} />
                <ConfidenceBadge confidence={f.confidence} targetType={f.targetType} />
                <StatusBadge status={f.ruleStatus} />
              </span>
              <span className="mt-1 block text-xs text-slate-600">
                {f.edit
                  ? "콜백 인자 점검"
                  : f.side === "NEXA"
                    ? "넥사크로 함수명 호출(미전환 잔존)"
                    : "웹스퀘어 함수명 호출(전환 후, 의도 확인)"}
                {f.edit ? (
                  <>
                    {" "}
                    · 1안/2안 버튼으로 선택 (기본: <code className="font-semibold">{f.edit.label}</code>)
                  </>
                ) : f.replacement ? (
                  <>
                    {" "}
                    · 대체안: <code className="font-semibold">{f.replacement}</code>
                  </>
                ) : (
                  " · 대체안 없음"
                )}
                {f.candidateCount > 1 ? (
                  <strong className="ml-1 text-orange-800">
                    · 같은 호출에 후보 {f.candidateCount}개
                  </strong>
                ) : null}
              </span>
            </button>
            <div className="border-t border-slate-100 px-3 py-2 text-sm">
              {f.reason ? <Reason text={f.reason} /> : null}
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <button type="button" onClick={() => onChange(f)} className={btn}>
                  {f.changeable ? "변경" : "직접 수정"}
                </button>
                {f.changeable ? null : (
                  <span className="text-xs text-slate-700">
                    자동 변경하지 않습니다. 사유·대체안을 확인하고 직접 수정하세요.
                  </span>
                )}
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function Reason({ text }: { text: string }) {
  if (text.length <= 90) return <p className="whitespace-pre-wrap text-slate-800">{text}</p>;
  return (
    <details>
      <summary className="cursor-pointer text-slate-800">
        {text.slice(0, 90)}… <span className="text-blue-700 underline">사유 전체 보기</span>
      </summary>
      <p className="mt-1 whitespace-pre-wrap text-slate-800">{text}</p>
    </details>
  );
}
