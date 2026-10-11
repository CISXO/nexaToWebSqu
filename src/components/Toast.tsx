"use client";

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";

// 완료·알림 토스트. 화면 아래 가운데에 잠깐 떴다가 사라진다(오류는 조금 더 오래).
// 모달(<dialog>)이 열려 있는 동안에는 모달 뒤에 가려지므로, 모달을 닫은 뒤에 호출한다.

type Kind = "success" | "error";
interface Item {
  id: number;
  message: string;
  kind: Kind;
}

const ToastContext = createContext<(message: string, kind?: Kind) => void>(() => {});

export function useToast() {
  return useContext(ToastContext);
}

const DURATION: Record<Kind, number> = { success: 3000, error: 6000 };
const MAX_VISIBLE = 4;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Item[]>([]);
  const counter = useRef(0);

  const remove = useCallback((id: number) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (message: string, kind: Kind = "success") => {
      const id = ++counter.current;
      setItems((prev) => [...prev.slice(-(MAX_VISIBLE - 1)), { id, message, kind }]);
      setTimeout(() => remove(id), DURATION[kind]);
    },
    [remove],
  );

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-6 z-[100] flex flex-col items-center gap-2 px-4"
      >
        {items.map((t) => (
          <div
            key={t.id}
            role={t.kind === "error" ? "alert" : "status"}
            data-testid="toast"
            data-toast-kind={t.kind}
            className={`pointer-events-auto flex max-w-xl items-start gap-3 rounded-lg px-4 py-3 text-sm font-medium text-white shadow-lg ${
              t.kind === "error" ? "bg-red-700" : "bg-slate-900"
            }`}
          >
            <span aria-hidden="true" className={t.kind === "error" ? "text-red-200" : "text-emerald-400"}>
              {t.kind === "error" ? "!" : "✓"}
            </span>
            <span className="min-w-0 flex-1">{t.message}</span>
            <button
              type="button"
              onClick={() => remove(t.id)}
              aria-label="알림 닫기"
              className="-my-1 rounded px-1.5 py-0.5 text-white/70 hover:bg-white/10 hover:text-white"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
