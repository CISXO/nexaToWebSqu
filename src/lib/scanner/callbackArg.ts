// 메시지 콜백 인자 점검 (순수 함수). 연구관리시스템_전환작업_정리.md 1-9.
// gfn_msg(팝업ID, 코드, 치환값, 유형, 콜백) 의 콜백이 "fn_msgAfter" 처럼 함수 이름 문자열이면
// 호출 코드가 아니라서 콜백이 불리지 않는다 → 인자 1개만 바꾸는 변경 후보(1안/2안)를 만든다.
// 이 점검은 해당 함수명의 규칙이 등록되어 있을 때만 동작한다(scan.ts 가 규칙 매칭 결과에서 호출).

import type { ArgEdit } from "./types";

interface CallbackArgSpec {
  /** 팝업ID 인자 위치 (0부터) */
  idArg: number;
  /** 콜백 인자 위치 (0부터) */
  callbackArg: number;
  /** 콜백 인자를 생략하면 공통이 호출해 주는 함수 */
  defaultCallback: string;
}

export const CALLBACK_ARG_SPECS: Record<string, CallbackArgSpec> = {
  gfn_msg: { idArg: 0, callbackArg: 4, defaultCallback: "fn_msgAfter" },
};

interface ArgSpan {
  start: number;
  end: number;
}

const OPEN = "([{";
const CLOSE = ")]}";

/**
 * 마스킹된 텍스트에서 `(` 위치부터 인자 구간을 나눈다. 앞뒤 공백은 원본(text) 기준으로 뺀다.
 * 문자열·주석은 마스킹으로 공백이 되어 있으므로 쉼표·괄호만 보면 된다. 닫는 괄호가 없으면 null.
 */
export function splitArgs(masked: string, text: string, openParen: number): ArgSpan[] | null {
  const spans: ArgSpan[] = [];
  let depth = 0;
  let segStart = openParen + 1;
  const push = (end: number) => {
    let s = segStart;
    let e = end;
    while (s < e && /\s/.test(text[s])) s++;
    while (e > s && /\s/.test(text[e - 1])) e--;
    spans.push({ start: s, end: e });
  };
  for (let i = openParen + 1; i < masked.length; i++) {
    const c = masked[i];
    if (OPEN.includes(c)) depth++;
    else if (CLOSE.includes(c)) {
      if (depth === 0) {
        push(i);
        // 인자 없는 호출 `fn()` 은 빈 목록
        if (spans.length === 1 && spans[0].start === spans[0].end) return [];
        return spans;
      }
      depth--;
    } else if (c === "," && depth === 0) {
      push(i);
      segStart = i + 1;
    }
  }
  return null;
}

const STRING_IDENT_RE = /^(["'])([A-Za-z_$][A-Za-z0-9_$]*)\1$/;
const EXPLICIT_RE = /^(["'])scwin\.([A-Za-z_$][A-Za-z0-9_$]*)\(/;
const EMPTY_STRING_RE = /^(["'])\1$/;
const IDENT_RE = /^[A-Za-z_$][A-Za-z0-9_$.]*$/;

export interface CallbackArgResult {
  /** 콜백 인자가 "fn_msgAfter" 처럼 함수 이름 문자열 → 콜백이 불리지 않는 상태 */
  broken: boolean;
  /** 1안/2안 변경 후보 (현재와 같아지는 후보, 줄을 넘는 후보는 뺀다) */
  presets: Omit<ArgEdit, "column">[];
}

const NONE: CallbackArgResult = { broken: false, presets: [] };

/**
 * 콜백 인자 1안/2안 후보.
 * - 1안(명시형): 콜백 인자를 "scwin.함수(팝업ID)" 로 (팝업ID가 변수면 "scwin.함수(" + 변수 + ")"). 콜백 인자가 없으면 추가.
 * - 2안(생략형): 기본 콜백(fn_msgAfter)이고 콜백이 마지막 인자일 때만, 콜백 인자 삭제.
 * 변경 구간에 줄바꿈이 있으면(줄 번호 유지 불가) 그 후보는 만들지 않는다.
 */
export function callbackArgPresets(
  text: string,
  masked: string,
  fnOffset: number,
  fn: string,
): CallbackArgResult {
  const spec = CALLBACK_ARG_SPECS[fn];
  if (!spec) return NONE;
  let p = fnOffset + fn.length;
  while (p < masked.length && /\s/.test(masked[p])) p++;
  if (masked[p] !== "(") return NONE;
  const args = splitArgs(masked, text, p);
  if (!args || args.length < spec.callbackArg) return NONE;

  const cb = args.length > spec.callbackArg ? args[spec.callbackArg] : null;
  const cbRaw = cb ? text.slice(cb.start, cb.end) : "";
  let quote = '"';
  let cbFn: string;
  let broken = false;
  if (!cb || EMPTY_STRING_RE.test(cbRaw)) {
    cbFn = spec.defaultCallback;
    if (cb) quote = cbRaw[0];
  } else {
    const bare = STRING_IDENT_RE.exec(cbRaw);
    const explicitM = EXPLICIT_RE.exec(cbRaw);
    if (bare) {
      [, quote, cbFn] = bare;
      broken = true;
    } else if (explicitM) {
      [, quote, cbFn] = explicitM;
    } else {
      return NONE; // 식·변수 등: 판단하지 않음
    }
  }

  const idRaw = text.slice(args[spec.idArg].start, args[spec.idArg].end);
  const idLit = STRING_IDENT_RE.exec(idRaw);
  let explicit: string | null = null;
  if (idLit) explicit = `${quote}scwin.${cbFn}(${idLit[2]})${quote}`;
  else if (IDENT_RE.test(idRaw)) explicit = `${quote}scwin.${cbFn}(${quote} + ${idRaw} + ${quote})${quote}`;

  const presets: Omit<ArgEdit, "column">[] = [];
  if (explicit) {
    if (cb) {
      presets.push({
        offset: cb.start,
        length: cb.end - cb.start,
        expected: cbRaw,
        replacement: explicit,
        label: `1안 명시형: ${explicit}`,
      });
    } else {
      const at = args[spec.callbackArg - 1].end;
      presets.push({
        offset: at,
        length: 0,
        expected: "",
        replacement: `, ${explicit}`,
        label: `1안 명시형: ${explicit} 추가`,
      });
    }
  }
  if (cb && cbFn === spec.defaultCallback && args.length === spec.callbackArg + 1) {
    const from = args[spec.callbackArg - 1].end;
    presets.push({
      offset: from,
      length: cb.end - from,
      expected: text.slice(from, cb.end),
      replacement: "",
      label: `2안 생략형: 5번째 인자 삭제 (공통이 scwin.${cbFn}(팝업ID) 호출)`,
    });
  }
  return {
    broken,
    presets: presets.filter((e) => e.replacement !== e.expected && !/[\r\n]/.test(e.expected)),
  };
}
