"use client";

import { memo, useEffect, useRef } from "react";

// 소스 뷰어: 업로드한 코드를 텍스트 노드로만 렌더링한다(HTML 해석 없음, innerHTML 계열 API 미사용).
// 줄 높이를 고정(20px)해 content-visibility 로 큰 파일도 가볍게 그린다.

const LINE_HEIGHT = 20;

const Line = memo(function Line({
  n,
  text,
  marked,
  active,
}: {
  n: number;
  text: string;
  marked: boolean;
  active: boolean;
}) {
  return (
    <div
      data-line={n}
      data-marked={marked ? "true" : undefined}
      data-active={active ? "true" : undefined}
      className={`flex w-max min-w-full [content-visibility:auto] ${
        active ? "bg-yellow-200" : marked ? "bg-amber-50" : ""
      }`}
      style={{ height: LINE_HEIGHT, containIntrinsicSize: `auto ${LINE_HEIGHT}px` }}
    >
      <span
        className={`sticky left-0 z-10 w-16 shrink-0 select-none pr-2 text-right text-slate-500 ${
          active ? "bg-yellow-200" : marked ? "bg-amber-100" : "bg-slate-100"
        }`}
      >
        {marked ? <span aria-label="검출된 줄">● </span> : null}
        {n}
      </span>
      <span className="whitespace-pre pl-3">{text === "" ? " " : text}</span>
    </div>
  );
});

export default function SourceViewer({
  lines,
  markerLines,
  activeLine,
  scrollTick,
}: {
  lines: string[];
  markerLines: ReadonlySet<number>;
  activeLine: number | null;
  scrollTick: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (activeLine === null) return;
    const container = containerRef.current;
    const el = container?.querySelector<HTMLElement>(`[data-line="${activeLine}"]`);
    if (!container || !el) return;
    container.scrollTop = Math.max(0, el.offsetTop - container.clientHeight / 2 + LINE_HEIGHT / 2);
  }, [activeLine, scrollTick]);

  return (
    <div
      ref={containerRef}
      data-testid="source-viewer"
      role="region"
      aria-label="소스 뷰어"
      tabIndex={0}
      className="relative h-full min-h-64 overflow-auto rounded border border-slate-300 bg-white font-mono text-[13px] leading-5 [tab-size:4]"
    >
      {lines.map((text, i) => (
        <Line
          key={i}
          n={i + 1}
          text={text}
          marked={markerLines.has(i + 1)}
          active={activeLine === i + 1}
        />
      ))}
    </div>
  );
}
