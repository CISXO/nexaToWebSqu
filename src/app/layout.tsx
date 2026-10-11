import type { Metadata } from "next";
import AppHeader from "@/components/AppHeader";
import { ToastProvider } from "@/components/Toast";
import "./globals.css";

export const metadata: Metadata = {
  title: "전환 닥터",
  description:
    "넥사크로 → 웹스퀘어 전환 후 남는 함수 차이·의도 차이를 줄 번호와 함께 검출하고, 팀의 전환 사례를 규칙으로 공유하는 도구",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-white focus:px-3 focus:py-2"
        >
          본문으로 건너뛰기
        </a>
        <ToastProvider>
          <AppHeader />
          <main id="main" className="flex-1 flex flex-col">
            {children}
          </main>
        </ToastProvider>
      </body>
    </html>
  );
}
