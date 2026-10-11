"use client";

import { useMemo, useState } from "react";
import {
  applyChangeRequests,
  applyLineEdit,
  applyPresetToLine,
  presetName,
  previewChange,
  previewLineEdit,
  toChangeRequest,
  type BulkItem,
  type ChangeRequest,
} from "@/lib/diff/apply";
import type { Finding } from "@/lib/scanner/types";
import Modal from "../Modal";
import { btn, btnPrimary, ConfidenceBadge, TypeBadge } from "../ui";

// 일괄 변경:
// - 단순 치환(REPLACE) 항목: 체크한 것에 자동 치환 결과를 넣어 두고, "변경 후" 줄을 직접 고칠 수 있다.
// - 의도 다름·미지원 항목: 자동 변경하지 않는다. 원문 줄을 직접 고친 항목만 적용된다.
// 직접 고친 줄은 줄 전체를 교체하므로, 같은 줄에 적용할 항목이 둘 이상이면 함께 적용할 수 없다.

interface Row {
  kind: "auto" | "manual";
  finding: Finding;
  excluded: boolean;
  defaultChecked: boolean;
  before: string;
  /** 자동 치환 결과(직접 수정 항목은 원문 줄 그대로) */
  defaultAfter: string;
  unavailable: boolean;
}

interface LineEdit {
  line: number;
  before: string;
  after: string;
}

function buildRow(text: string, finding: Finding, kind: Row["kind"], item?: BulkItem): Row {
  const base = {
    kind,
    finding,
    excluded: item?.excluded ?? false,
    defaultChecked: item?.defaultChecked ?? false,
  };
  try {
    const req = toChangeRequest(finding);
    const p = kind === "auto" && req ? previewChange(text, req) : previewLineEdit(text, finding);
    return { ...base, before: p.before, defaultAfter: p.after, unavailable: false };
  } catch {
    return { ...base, before: "(미리보기 불가)", defaultAfter: "", unavailable: true };
  }
}

export default function BulkModal({
  items,
  manualFindings,
  text,
  onApply,
  onClose,
}: {
  items: BulkItem[];
  /** 자동 변경 대상이 아닌 검출 항목(의도 다름·미지원 등) — 직접 수정용 */
  manualFindings: Finding[];
  text: string;
  onApply: (newText: string, message: string, copy: boolean) => void;
  onClose: () => void;
}) {
  const [checked, setChecked] = useState<Set<string>>(
    () => new Set(items.filter((i) => i.defaultChecked).map((i) => i.finding.id)),
  );
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"auto" | "manual">("auto");

  const autoRows = useMemo(() => items.map((item) => buildRow(text, item.finding, "auto", item)), [items, text]);
  const manualRows = useMemo(
    () => manualFindings.map((f) => buildRow(text, f, "manual")),
    [manualFindings, text],
  );

  const afterOf = (r: Row) => edits[r.finding.id] ?? r.defaultAfter;
  const isEdited = (r: Row) => afterOf(r) !== r.defaultAfter;
  const included = (r: Row) =>
    !r.unavailable && (r.kind === "auto" ? checked.has(r.finding.id) : isEdited(r));
  const autoCount = autoRows.filter(included).length;
  const manualCount = manualRows.filter(included).length;
  const count = autoCount + manualCount;

  /** 체크를 바꾼다. 같은 호출(같은 위치)의 다른 후보는 하나만 선택되도록 나머지를 해제한다. */
  const setCheck = (r: Row, on: boolean) => {
    setError(null);
    setChecked((prev) => {
      const next = new Set(prev);
      if (on) {
        next.add(r.finding.id);
        for (const o of autoRows) {
          if (o !== r && o.finding.offset === r.finding.offset) next.delete(o.finding.id);
        }
      } else {
        next.delete(r.finding.id);
      }
      return next;
    });
  };

  const edit = (r: Row, value: string) => {
    setError(null);
    setEdits((prev) => ({ ...prev, [r.finding.id]: value }));
    // 자동 치환 항목은 직접 고치면 적용 대상으로 함께 체크한다.
    if (r.kind === "auto") setCheck(r, true);
  };

  const reset = (r: Row) =>
    setEdits((prev) => {
      const next = { ...prev };
      delete next[r.finding.id];
      return next;
    });

  const apply = (copy: boolean) => {
    const requests: ChangeRequest[] = [];
    const lineEdits: LineEdit[] = [];
    const perLine = new Map<number, number>();
    for (const r of [...autoRows, ...manualRows]) {
      if (!included(r)) continue;
      const after = afterOf(r);
      if (/[\r\n]/.test(after)) {
        setError(`${r.finding.line}줄: 변경 후 줄에는 줄바꿈을 넣을 수 없습니다.`);
        return;
      }
      perLine.set(r.finding.line, (perLine.get(r.finding.line) ?? 0) + 1);
      const req = toChangeRequest(r.finding);
      if (r.kind === "auto" && req && after === r.defaultAfter) requests.push(req);
      else lineEdits.push({ line: r.finding.line, before: r.before, after });
    }
    if (requests.length + lineEdits.length === 0) return;
    const clash = lineEdits.find((e) => (perLine.get(e.line) ?? 0) > 1);
    if (clash) {
      setError(
        `${clash.line}줄에 적용할 항목이 여러 개라 직접 수정한 줄과 함께 적용할 수 없습니다. 한 줄에는 하나만 선택하세요.`,
      );
      return;
    }
    try {
      let next = requests.length > 0 ? applyChangeRequests(text, requests) : text;
      for (const e of lineEdits) next = applyLineEdit(next, e.line, e.before, e.after);
      onApply(next, `${requests.length + lineEdits.length}건 적용 완료되었습니다.`, copy);
    } catch (e) {
      setError(e instanceof Error ? e.message : "적용하지 못했습니다.");
    }
  };

  const editor = (r: Row) => (
    <div className="mt-1 flex flex-col gap-1 font-mono text-xs">
      <div className="overflow-x-auto whitespace-pre rounded bg-slate-50 px-1.5 py-1 text-red-800">- {r.before}</div>
      <div className="flex items-center gap-1">
        <span aria-hidden="true" className="text-emerald-800">
          +
        </span>
        <input
          type="text"
          value={afterOf(r)}
          onChange={(e) => edit(r, e.target.value)}
          disabled={r.unavailable}
          spellCheck={false}
          aria-label={`${r.finding.line}줄 변경 후`}
          data-testid="bulk-after"
          className="min-w-0 flex-1 rounded border border-slate-300 bg-white px-1.5 py-1 font-mono text-xs"
        />
        {isEdited(r) ? (
          <button type="button" className={`${btn} px-2! py-1! text-xs!`} onClick={() => reset(r)}>
            기본값
          </button>
        ) : null}
      </div>
      {!r.unavailable && r.finding.presets && r.finding.presets.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1 font-sans">
          <span className="text-xs text-slate-700">콜백 인자:</span>
          {r.finding.presets.map((p) => {
            const line = applyPresetToLine(r.before, p);
            return (
              <button
                key={p.label}
                type="button"
                title={p.label}
                disabled={line === null}
                className={`${afterOf(r) === line ? btnPrimary : btn} px-2! py-1! text-xs!`}
                onClick={() => line !== null && edit(r, line)}
              >
                {presetName(p)}
              </button>
            );
          })}
        </div>
      ) : null}
      {isEdited(r) ? (
        <span className="font-sans text-xs font-semibold text-blue-800">직접 수정됨</span>
      ) : null}
    </div>
  );

  const tabButton = (key: "auto" | "manual", label: string, total: number, picked: number) => (
    <button
      type="button"
      role="tab"
      id={`bulk-tab-${key}`}
      aria-selected={tab === key}
      aria-controls={`bulk-panel-${key}`}
      data-testid={`bulk-tab-${key}`}
      onClick={() => setTab(key)}
      className={`rounded-t border border-b-0 px-3 py-1.5 text-sm ${
        tab === key
          ? "border-slate-300 bg-white font-semibold text-slate-900"
          : "border-transparent bg-slate-100 text-slate-700 hover:bg-slate-200"
      }`}
    >
      {label} {total}건
      {picked > 0 ? (
        <span className="ml-1.5 rounded bg-blue-100 px-1.5 py-0.5 text-xs font-semibold text-blue-900">
          적용 {picked}
        </span>
      ) : null}
    </button>
  );

  return (
    <Modal title="일괄 변경" onClose={onClose} fallbackFocusId="finding-panel" wide>
      <div className="flex flex-col gap-3 text-sm">
        <p className="text-slate-700">
          <strong>변경 후 줄은 모두 직접 고칠 수 있습니다.</strong> 위 탭에서 <strong>단순 치환</strong>과{" "}
          <strong>직접 수정</strong>(의도 다름·미지원)을 오가며 고른 뒤, 아래 버튼으로 <strong>두 탭의 선택
          항목을 한 번에</strong> 적용합니다.
        </p>

        {autoRows.length === 0 && manualRows.length === 0 ? (
          <p className="rounded border border-slate-300 bg-slate-50 px-3 py-2">일괄 변경할 항목이 없습니다.</p>
        ) : (
          <>
            <div role="tablist" aria-label="일괄 변경 종류" className="flex gap-1 border-b border-slate-300">
              {tabButton("auto", "단순 치환", autoRows.length, autoCount)}
              {tabButton("manual", "직접 수정", manualRows.length, manualCount)}
            </div>

            <div id="bulk-panel-auto" role="tabpanel" aria-labelledby="bulk-tab-auto" hidden={tab !== "auto"}>
              <p className="mb-2 text-xs text-slate-700">
                체크한 항목에 자동 치환 결과가 들어 있습니다. 타입 지정 규칙 + 후보 1개만 기본 선택됩니다. 고치면 자동으로
                체크됩니다.
              </p>
              {autoRows.length === 0 ? (
                <p className="rounded border border-slate-300 bg-slate-50 px-3 py-2">단순 치환 항목이 없습니다.</p>
              ) : (
                <ul className="flex flex-col gap-2" data-testid="bulk-list">
                  {autoRows.map((r) => {
                    const f = r.finding;
                    const id = `bulk-${f.id}`;
                    return (
                      <li
                        key={f.id}
                        data-bulk-line={f.line}
                        data-bulk-excluded={r.excluded ? "true" : "false"}
                        className="rounded border border-slate-300 bg-white px-3 py-2"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <input
                            id={id}
                            type="checkbox"
                            checked={checked.has(f.id)}
                            disabled={r.unavailable}
                            onChange={(e) => setCheck(r, e.target.checked)}
                            className="h-4 w-4"
                          />
                          <label htmlFor={id} className="flex cursor-pointer flex-wrap items-center gap-2">
                            <span className="font-mono font-bold">{f.line}줄</span>
                            {f.edit ? (
                              <code>
                                {f.fn} 콜백 인자 · 1안/2안 버튼으로 선택 (기본 1안)
                              </code>
                            ) : (
                              <code>
                                {f.fn} → {f.replacement}
                              </code>
                            )}
                            <ConfidenceBadge confidence={f.confidence} targetType={f.targetType} />
                          </label>
                        </div>
                        {r.excluded ? (
                          <p className="mt-1 text-xs text-orange-800">
                            같은 호출에 후보 {f.candidateCount}개 — 하나만 선택할 수 있습니다(하나를 선택하면 나머지 후보는
                            해제됩니다). 어느 쪽이 맞는지 확인하고 선택하세요.
                          </p>
                        ) : !r.defaultChecked ? (
                          <p className="mt-1 text-xs text-orange-800">
                            경고: 대상 타입이 지정되지 않은 규칙입니다. 이름만 같은 다른 객체의 함수일 수 있어 기본 선택하지
                            않았습니다. 확인한 뒤 직접 체크하세요.
                          </p>
                        ) : null}
                        {editor(r)}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <div id="bulk-panel-manual" role="tabpanel" aria-labelledby="bulk-tab-manual" hidden={tab !== "manual"}>
              <p className="mb-2 text-xs text-slate-700">
                의도 다름·미지원 항목은 자동으로 바꾸지 않습니다. 변경 후 줄을 직접 고친 항목만 함께 적용됩니다.
              </p>
              {manualRows.length === 0 ? (
                <p className="rounded border border-slate-300 bg-slate-50 px-3 py-2">직접 수정할 항목이 없습니다.</p>
              ) : (
                <ul className="flex flex-col gap-2" data-testid="bulk-manual-list">
                  {manualRows.map((r) => {
                    const f = r.finding;
                    return (
                      <li
                        key={f.id}
                        data-bulk-line={f.line}
                        className="rounded border border-slate-300 bg-white px-3 py-2"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono font-bold">{f.line}줄</span>
                          <code>{f.receiver ? `${f.receiver}.${f.fn}` : f.fn}</code>
                          <TypeBadge type={f.ruleType} />
                          <ConfidenceBadge confidence={f.confidence} targetType={f.targetType} />
                          <span className="text-xs text-slate-700">
                            {f.replacement ? (
                              <>
                                참고 대체안: <code className="font-semibold">{f.replacement}</code>
                              </>
                            ) : (
                              "참고 대체안 없음"
                            )}
                          </span>
                        </div>
                        {editor(r)}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </>
        )}

        {error ? (
          <p role="alert" className="rounded border border-red-300 bg-red-50 px-3 py-2 text-red-900">
            {error}
          </p>
        ) : null}
        <div className="flex flex-wrap items-center justify-end gap-2">
          <span className="mr-auto text-xs text-slate-600">
            단순 치환 {autoCount}건 + 직접 수정 {manualCount}건
          </span>
          <button type="button" className={btn} onClick={onClose}>
            취소
          </button>
          <button
            type="button"
            className={btn}
            onClick={() => apply(true)}
            disabled={count === 0}
            data-testid="bulk-apply-copy"
          >
            적용 후 복사 ({count}건)
          </button>
          <button
            type="button"
            className={btnPrimary}
            onClick={() => apply(false)}
            disabled={count === 0}
            data-testid="bulk-apply"
          >
            선택 항목 적용 ({count}건)
          </button>
        </div>
      </div>
    </Modal>
  );
}
