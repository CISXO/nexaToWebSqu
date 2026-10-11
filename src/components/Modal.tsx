"use client";

import { useEffect, useId, useLayoutEffect, useRef, type ReactNode } from "react";

// 네이티브 <dialog> 모달: 열리면 포커스가 모달 안으로 이동하고 Esc 로 닫힌다.
// 닫히면 열기 전 포커스 위치로 돌아간다(그 요소가 사라졌으면 fallbackFocusId 요소로).

export default function Modal({
  title,
  onClose,
  children,
  fallbackFocusId,
  wide = false,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  fallbackFocusId?: string;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const closeRef = useRef(onClose);
  // 정리(cleanup)에서 dialog.close() 를 부르면 비동기 close 이벤트가 오는데, 이는 사용자의 닫기가 아니므로 무시한다.
  const ignoreClose = useRef(false);

  useEffect(() => {
    closeRef.current = onClose;
  });

  // 열기 직전 포커스 위치(React StrictMode 의 개발용 재마운트에도 유지되도록 ref 에 보관)
  const previousRef = useRef<HTMLElement | null>(null);

  useLayoutEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (previousRef.current === null) previousRef.current = document.activeElement as HTMLElement | null;
    if (!dialog.open) dialog.showModal();
    return () => {
      ignoreClose.current = true;
      setTimeout(() => {
        ignoreClose.current = false;
      }, 0);
      if (dialog.open) dialog.close();
      // 같은 커밋에서 원래 버튼이 사라질 수 있으므로(예: 적용 후 재스캔) 커밋 이후에 복원한다.
      const previous = previousRef.current;
      setTimeout(() => {
        if (previous && previous.isConnected) previous.focus();
        else if (fallbackFocusId) document.getElementById(fallbackFocusId)?.focus();
      }, 0);
    };
  }, [fallbackFocusId]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={() => {
        if (!ignoreClose.current) closeRef.current();
      }}
      className={`m-auto w-[calc(100%-2rem)] rounded-lg border border-slate-300 bg-white p-0 text-slate-900 shadow-xl ${
        wide ? "max-w-4xl" : "max-w-2xl"
      }`}
    >
      <div className="flex max-h-[85vh] flex-col">
        <div className="flex items-center justify-between gap-4 border-b border-slate-200 px-5 py-3">
          <h2 id={titleId} className="text-base font-bold">
            {title}
          </h2>
          <button
            type="button"
            onClick={() => ref.current?.close()}
            className="rounded px-2 py-1 text-sm text-slate-600 hover:bg-slate-100"
            aria-label="닫기"
          >
            닫기 (Esc)
          </button>
        </div>
        <div className="overflow-auto px-5 py-4">{children}</div>
      </div>
    </dialog>
  );
}
