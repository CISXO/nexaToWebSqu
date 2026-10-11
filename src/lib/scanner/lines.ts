// 줄 처리 유틸 (순수 함수). \r\n, \n, \r 모두 줄바꿈으로 본다. 줄 번호는 1부터.

/** 각 줄의 시작 오프셋. 마지막 줄바꿈 뒤의 빈 조각은 줄로 세지 않는다(단, 빈 텍스트는 0줄). */
export function computeLineStarts(text: string): number[] {
  const starts: number[] = [];
  if (text.length === 0) return starts;
  starts.push(0);
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    if (c === 10) {
      if (i + 1 < text.length) starts.push(i + 1);
    } else if (c === 13) {
      if (text.charCodeAt(i + 1) === 10) i++;
      if (i + 1 < text.length) starts.push(i + 1);
    }
  }
  return starts;
}

/** 줄 내용(줄바꿈 문자 제외) 배열. */
export function splitLines(text: string): string[] {
  const starts = computeLineStarts(text);
  return starts.map((start, idx) => {
    const end = idx + 1 < starts.length ? starts[idx + 1] : text.length;
    return stripEol(text.slice(start, end));
  });
}

function stripEol(s: string): string {
  if (s.endsWith("\r\n")) return s.slice(0, -2);
  if (s.endsWith("\n") || s.endsWith("\r")) return s.slice(0, -1);
  return s;
}

export function countLines(text: string): number {
  return computeLineStarts(text).length;
}

/** 오프셋 → {line, column} (1-based). starts 는 computeLineStarts 결과. */
export function offsetToPosition(starts: number[], offset: number): { line: number; column: number } {
  let lo = 0;
  let hi = starts.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (starts[mid] <= offset) lo = mid;
    else hi = mid - 1;
  }
  return { line: lo + 1, column: offset - (starts[lo] ?? 0) + 1 };
}

/** 줄의 [시작, 끝) 오프셋. 끝은 줄바꿈 문자를 제외한다. */
export function lineRange(text: string, starts: number[], line: number): { start: number; end: number } | null {
  if (line < 1 || line > starts.length) return null;
  const start = starts[line - 1];
  const rawEnd = line < starts.length ? starts[line] : text.length;
  let end = rawEnd;
  if (end > start && text.charCodeAt(end - 1) === 10) end--;
  if (end > start && text.charCodeAt(end - 1) === 13) end--;
  return { start, end };
}
