// 공용 표시 컴포넌트: 배지(색만으로 구분하지 않고 항상 텍스트를 함께 표시), 배너.

import type { ReactNode } from "react";
import {
  RULE_STATUS_LABEL,
  RULE_TYPE_LABEL,
  type RuleStatus,
  type RuleType,
} from "@/lib/rules/types";
import type { Confidence } from "@/lib/scanner/types";

const TYPE_STYLE: Record<RuleType, string> = {
  REPLACE: "border-emerald-400 bg-emerald-50 text-emerald-900",
  INTENT_DIFF: "border-amber-400 bg-amber-50 text-amber-900",
  UNSUPPORTED: "border-red-400 bg-red-50 text-red-900",
};

const base = "inline-block whitespace-nowrap rounded border px-1.5 py-0.5 text-xs font-medium";

export function TypeBadge({ type }: { type: RuleType }) {
  return <span className={`${base} ${TYPE_STYLE[type]}`}>{RULE_TYPE_LABEL[type]}</span>;
}

export function ConfidenceBadge({
  confidence,
  targetType,
}: {
  confidence: Confidence;
  targetType: string | null;
}) {
  return confidence === "CHECK" ? (
    <span className={`${base} border-orange-400 bg-orange-50 text-orange-900`}>
      가능성 있음, 확인 필요
    </span>
  ) : (
    <span className={`${base} border-sky-400 bg-sky-50 text-sky-900`}>
      대상 타입 {targetType} 확인
    </span>
  );
}

export function StatusBadge({ status }: { status: RuleStatus }) {
  return (
    <span
      className={`${base} ${
        status === "VERIFIED"
          ? "border-indigo-400 bg-indigo-50 text-indigo-900"
          : "border-slate-300 bg-slate-50 text-slate-700"
      }`}
    >
      {RULE_STATUS_LABEL[status]}
    </span>
  );
}

export function Banner({
  kind,
  children,
  action,
}: {
  kind: "error" | "warn" | "info" | "success";
  children: ReactNode;
  action?: ReactNode;
}) {
  const style = {
    error: "border-red-300 bg-red-50 text-red-900",
    warn: "border-amber-300 bg-amber-50 text-amber-900",
    info: "border-slate-300 bg-slate-50 text-slate-800",
    success: "border-emerald-300 bg-emerald-50 text-emerald-900",
  }[kind];
  return (
    <div
      role={kind === "error" ? "alert" : "status"}
      className={`flex flex-wrap items-center gap-3 rounded border px-3 py-2 text-sm ${style}`}
    >
      <div className="min-w-0 flex-1">{children}</div>
      {action}
    </div>
  );
}

export const btn =
  "rounded border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-800 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50";
export const btnPrimary =
  "rounded border border-slate-900 bg-slate-900 px-3 py-1.5 text-sm font-semibold text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50";
