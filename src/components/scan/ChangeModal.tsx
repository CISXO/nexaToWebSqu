"use client";

import { useState } from "react";
import {
  applyLineEdit,
  applyPresetToLine,
  presetName,
  previewChange,
  previewLineEdit,
  toChangeRequest,
  type LinePreview,
} from "@/lib/diff/apply";
import type { Finding } from "@/lib/scanner/types";
import Modal from "../Modal";
import { btn, btnPrimary, ConfidenceBadge, TypeBadge } from "../ui";

type Init = { preview: LinePreview; error: null } | { preview: null; error: string };

/** 자동 변경 대상이면 대체안이 적용된 줄, 아니면(직접 수정) 원문 줄 그대로를 미리보기로 만든다. */
function init(text: string, finding: Finding): Init {
  const req = toChangeRequest(finding);
  try {
    return { preview: req ? previewChange(text, req) : previewLineEdit(text, finding), error: null };
  } catch (e) {
    return { preview: null, error: e instanceof Error ? e.message : "미리보기를 만들 수 없습니다." };
  }
}

export default function ChangeModal({
  finding,
  text,
  onApply,
  onClose,
}: {
  finding: Finding;
  text: string;
  onApply: (newText: string, message: string, copy: boolean) => void;
  onClose: () => void;
}) {
  const [initial] = useState(() => init(text, finding));
  const [after, setAfter] = useState(initial.preview?.after ?? "");
  const [error, setError] = useState<string | null>(initial.error);
  const hasNewline = /[\r\n]/.test(after);
  const preview = initial.preview;
  const manual = toChangeRequest(finding) === null;
  const unchanged = preview !== null && after === preview.before;

  const apply = (copy: boolean) => {
    if (!preview) return;
    if (manual && unchanged) {
      setError("수정한 내용이 없습니다. 변경 후 줄을 직접 고쳐 주세요.");
      return;
    }
    if (hasNewline) {
      setError("변경 후 줄에는 줄바꿈을 넣을 수 없습니다. 줄 번호가 바뀌기 때문입니다.");
      return;
    }
    try {
      const next = applyLineEdit(text, preview.line, preview.before, after);
      onApply(next, `${preview.line}줄 적용 완료되었습니다.`, copy);
    } catch (e) {
      setError(e instanceof Error ? e.message : "적용하지 못했습니다.");
    }
  };

  const col = preview ? preview.column - 1 : 0;
  // 강조 길이: 인자 변경이면 바뀌는 인자 구간, 아니면 함수명
  const markLen = finding.edit && !manual ? finding.edit.length : finding.fn.length;

  return (
    <Modal
      title={`${manual ? "직접 수정" : "변경 미리보기"} — ${finding.line}줄`}
      onClose={onClose}
      fallbackFocusId="finding-panel"
    >
      <div className="flex flex-col gap-4 text-sm">
        {manual ? (
          <>
            <p className="text-slate-700">
              이 항목은 자동으로 바꾸지 않습니다. 아래 <strong>변경 후 줄</strong>을 직접 고쳐 스크립트를
              수정하세요. 수정한 줄만 적용되며 줄 수는 바뀌지 않습니다.
            </p>
            <div className="flex flex-col gap-1 rounded border border-slate-200 bg-slate-50 px-3 py-2 text-slate-800">
              <span className="flex flex-wrap items-center gap-2">
                <code className="font-bold">{finding.fn}</code>
                <TypeBadge type={finding.ruleType} />
                <ConfidenceBadge confidence={finding.confidence} targetType={finding.targetType} />
              </span>
              <span>
                {finding.replacement ? (
                  <>
                    참고 대체안: <code className="font-semibold">{finding.replacement}</code>
                  </>
                ) : (
                  "참고 대체안 없음"
                )}
              </span>
              {finding.reason ? <span className="whitespace-pre-wrap">{finding.reason}</span> : null}
            </div>
          </>
        ) : finding.edit ? (
          <div className="flex flex-col gap-1 text-slate-700">
            <p>
              <code className="font-bold">{finding.fn}</code> 의 콜백 인자 한 곳만 바꿉니다. 아래{" "}
              <strong>1안/2안 버튼</strong>으로 고르세요(동작은 같음, 기본값 1안). 함수 이름·다른 인자·줄 수는 바꾸지
              않으며, 변경 후 줄은 직접 고칠 수 있습니다.
            </p>
          </div>
        ) : (
          <p className="text-slate-700">
            함수 이름 <code className="font-bold">{finding.fn}</code> →{" "}
            <code className="font-bold">{finding.replacement}</code> 한 곳만 바꿉니다. 수신 객체·인수·줄
            수는 바꾸지 않으며, 아래 변경 후 줄은 직접 고칠 수 있습니다.
          </p>
        )}
        {manual || finding.edit ? null : (
          <p className="flex flex-wrap items-center gap-2 text-slate-700">
            적용 규칙:
            <span>
              넥사크로 <code>{finding.fn}</code> → 웹스퀘어 <code>{finding.replacement}</code>
            </span>
            <ConfidenceBadge confidence={finding.confidence} targetType={finding.targetType} />
            {finding.candidateCount > 1 ? (
              <strong className="text-orange-800">
                같은 호출에 후보 {finding.candidateCount}개 — 이 후보(대상 타입:{" "}
                {finding.targetType ?? "미지정"})를 적용합니다
              </strong>
            ) : null}
          </p>
        )}

        {preview ? (
          <>
            <div>
              <div className="mb-1 font-semibold text-slate-800">변경 전 줄</div>
              <pre
                data-testid="diff-before"
                className="overflow-x-auto rounded border border-slate-300 bg-slate-50 p-2 font-mono text-[13px]"
              >
                {preview.before.slice(0, col)}
                <mark className="bg-red-200">{preview.before.slice(col, col + markLen)}</mark>
                {preview.before.slice(col + markLen)}
              </pre>
            </div>
            {finding.presets && finding.presets.length > 0 ? (
              <div className="flex flex-wrap items-center gap-2" data-testid="preset-buttons">
                <span className="font-semibold text-slate-800">콜백 인자:</span>
                {finding.presets.map((p) => {
                  const line = applyPresetToLine(preview.before, p);
                  return (
                    <button
                      key={p.label}
                      type="button"
                      className={after === line ? btnPrimary : btn}
                      disabled={line === null}
                      title={p.label}
                      onClick={() => {
                        if (line === null) return;
                        setAfter(line);
                        setError(null);
                      }}
                    >
                      {presetName(p)}
                    </button>
                  );
                })}
                <button
                  type="button"
                  className={btn}
                  onClick={() => {
                    setAfter(preview.before);
                    setError(null);
                  }}
                >
                  원문
                </button>
              </div>
            ) : null}
            <div>
              <label htmlFor="change-after" className="mb-1 block font-semibold text-slate-800">
                변경 후 줄 (직접 수정 가능, 줄바꿈 불가)
              </label>
              <textarea
                id="change-after"
                data-testid="diff-after"
                value={after}
                onChange={(e) => {
                  setAfter(e.target.value);
                  setError(null);
                }}
                rows={2}
                spellCheck={false}
                aria-invalid={hasNewline}
                aria-describedby="change-after-help"
                className="w-full rounded border border-slate-300 p-2 font-mono text-[13px]"
              />
              <p id="change-after-help" className="mt-1 text-xs text-slate-600">
                {manual
                  ? "기본값은 원문 줄입니다. "
                  : finding.edit
                    ? "기본값은 콜백 인자만 바꾼 줄입니다. "
                    : "기본값은 함수 이름만 바꾼 줄입니다. "}
                서버로 전송·저장되지 않고 브라우저 안에서만 적용됩니다.
              </p>
              {hasNewline ? (
                <p role="alert" className="mt-1 text-xs font-semibold text-red-700">
                  줄바꿈이 들어 있어 적용할 수 없습니다.
                </p>
              ) : null}
            </div>
          </>
        ) : null}

        {error ? (
          <p role="alert" className="rounded border border-red-300 bg-red-50 px-3 py-2 text-red-900">
            {error}
          </p>
        ) : null}

        <div className="flex justify-end gap-2">
          <button type="button" className={btn} onClick={onClose}>
            취소
          </button>
          <button
            type="button"
            className={btn}
            onClick={() => apply(true)}
            disabled={!preview || (manual && unchanged)}
            data-testid="apply-copy"
          >
            적용 후 복사
          </button>
          <button
            type="button"
            className={btnPrimary}
            onClick={() => apply(false)}
            disabled={!preview || (manual && unchanged)}
            data-testid="apply"
          >
            적용
          </button>
        </div>
      </div>
    </Modal>
  );
}
