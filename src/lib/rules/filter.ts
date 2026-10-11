// 규칙 목록 필터·정렬 (순수 함수). 모든 어댑터가 같은 함수를 써서 결과를 동일하게 유지한다.

import type { Rule, RuleFilter } from "./types";

export function applyRuleFilter(rules: Rule[], filter: RuleFilter = {}): Rule[] {
  const q = filter.q?.trim().toLowerCase() ?? "";
  const wantDeleted = filter.deleted === true;
  return rules.filter((r) => {
    if ((r.deletedAt !== null) !== wantDeleted) return false;
    if (filter.ruleType && r.ruleType !== filter.ruleType) return false;
    if (filter.status && r.status !== filter.status) return false;
    if (filter.targetType !== undefined && filter.targetType !== "") {
      if (filter.targetType === "none") {
        if (r.targetType !== null) return false;
      } else if (r.targetType !== filter.targetType) {
        return false;
      }
    }
    if (q) {
      const hit =
        r.nexaFn.toLowerCase().includes(q) || (r.wsFn?.toLowerCase().includes(q) ?? false);
      if (!hit) return false;
    }
    return true;
  });
}

/** 기본 정렬: nexaFn 오름차순, targetType null 우선, 같으면 id. */
export function sortRules(rules: Rule[]): Rule[] {
  return [...rules].sort((a, b) => {
    if (a.nexaFn !== b.nexaFn) return a.nexaFn < b.nexaFn ? -1 : 1;
    if (a.targetType !== b.targetType) {
      if (a.targetType === null) return -1;
      if (b.targetType === null) return 1;
      return a.targetType < b.targetType ? -1 : 1;
    }
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}
