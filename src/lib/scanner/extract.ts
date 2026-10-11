// 스캔 대상 텍스트 추출 (순수 함수). plan.md §6.1.
// 반환값은 원본과 길이가 같고 줄바꿈 위치가 동일하다(스캔 대상이 아닌 영역은 공백).

import { blankOut } from "./mask";

export const SCRIPT_EXTENSIONS = [".js", ".txt"] as const;
export const MARKUP_EXTENSIONS = [".xml", ".xfdl", ".html", ".htm"] as const;
export const ALLOWED_EXTENSIONS = [...SCRIPT_EXTENSIONS, ...MARKUP_EXTENSIONS] as const;

export function getExtension(fileName: string): string {
  const idx = fileName.lastIndexOf(".");
  return idx < 0 ? "" : fileName.slice(idx).toLowerCase();
}

export function isAllowedFileName(fileName: string): boolean {
  return (ALLOWED_EXTENSIONS as readonly string[]).includes(getExtension(fileName));
}

export function isMarkupFileName(fileName: string): boolean {
  return (MARKUP_EXTENSIONS as readonly string[]).includes(getExtension(fileName));
}

/**
 * 마크업(xml/xfdl/html)에서 <script> 블록 내용만 남기고 나머지를 공백 처리한다.
 * 1) XML/HTML 주석을 지운다  2) <script ...> … </script> 내용만 유지  3) CDATA 표식은 공백.
 */
export function extractMarkupScripts(text: string): string {
  const n = text.length;
  // 1) 주석 제거 (닫히지 않은 주석은 끝까지)
  let cleaned = "";
  let pos = 0;
  for (;;) {
    const open = text.indexOf("<!--", pos);
    if (open === -1) {
      cleaned += text.slice(pos);
      break;
    }
    cleaned += text.slice(pos, open);
    const close = text.indexOf("-->", open + 4);
    const end = close === -1 ? n : close + 3;
    cleaned += blankOut(text.slice(open, end));
    pos = end;
    if (pos >= n) break;
  }

  // 2) <script> 블록 내용만 유지
  const out = blankOut(cleaned).split("");
  const openRe = /<script\b[^>]*>/gi;
  let m: RegExpExecArray | null;
  while ((m = openRe.exec(cleaned)) !== null) {
    if (m[0].endsWith("/>")) continue; // <script src="..."/> : 내용 없음
    const contentStart = m.index + m[0].length;
    const closeRe = /<\/script\s*>/gi;
    closeRe.lastIndex = contentStart;
    const c = closeRe.exec(cleaned);
    const contentEnd = c ? c.index : n;
    for (let k = contentStart; k < contentEnd; k++) out[k] = cleaned[k];
    openRe.lastIndex = c ? c.index + c[0].length : n;
  }
  let result = out.join("");

  // 3) CDATA 표식 공백 처리 (길이 유지)
  result = result.replace(/<!\[CDATA\[|\]\]>/g, (s) => " ".repeat(s.length));
  return result;
}

/** 파일 종류에 따라 스캔 대상 텍스트를 만든다(마스킹 이전 단계). */
export function extractScanText(fileName: string, text: string): string {
  return isMarkupFileName(fileName) ? extractMarkupScripts(text) : text;
}
