// 주석·문자열 마스킹 (순수 함수).
// 결과는 입력과 길이가 같고 줄바꿈(\r, \n)은 그대로 유지한다 → 줄 번호·오프셋이 원본과 동일하다.
// 알려진 한계: 정규식 리터럴, 템플릿 리터럴의 ${} 내부 표현식은 특별 처리하지 않는다.

function blankChar(c: string): string {
  return c === "\n" || c === "\r" ? c : " ";
}

/** 줄바꿈만 남기고 나머지를 공백으로 바꾼다. */
export function blankOut(s: string): string {
  let out = "";
  for (let i = 0; i < s.length; i++) out += blankChar(s[i]);
  return out;
}

/** JS 텍스트에서 // 주석, 블록 주석, '…' "…" 문자열, `…` 템플릿 리터럴을 공백으로 치환한다. */
export function maskScript(text: string): string {
  const n = text.length;
  const out: string[] = new Array(n);
  let i = 0;
  const blank = (from: number, to: number) => {
    for (let k = from; k < to; k++) out[k] = blankChar(text[k]);
  };
  while (i < n) {
    const c = text[i];
    const next = text[i + 1];
    if (c === "/" && next === "/") {
      let j = i + 2;
      while (j < n && text[j] !== "\n" && text[j] !== "\r") j++;
      blank(i, j);
      i = j;
    } else if (c === "/" && next === "*") {
      const close = text.indexOf("*/", i + 2);
      const end = close === -1 ? n : close + 2;
      blank(i, end);
      i = end;
    } else if (c === "'" || c === '"') {
      let j = i + 1;
      while (j < n) {
        const d = text[j];
        if (d === "\\") {
          // 이스케이프(줄 이어쓰기 포함). 역슬래시 + CRLF 는 3글자를 건너뛴다.
          j += text[j + 1] === "\r" && text[j + 2] === "\n" ? 3 : 2;
          continue;
        }
        if (d === c) {
          j++;
          break;
        }
        if (d === "\n" || d === "\r") break; // 닫히지 않은 문자열은 줄 끝에서 종료
        j++;
      }
      const end = Math.min(j, n);
      blank(i, end);
      i = end;
    } else if (c === "`") {
      let j = i + 1;
      while (j < n) {
        const d = text[j];
        if (d === "\\") {
          j += 2;
          continue;
        }
        if (d === "`") {
          j++;
          break;
        }
        j++;
      }
      const end = Math.min(j, n);
      blank(i, end);
      i = end;
    } else {
      out[i] = c;
      i++;
    }
  }
  return out.join("");
}
