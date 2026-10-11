// 저장소 계약 (plan.md §5.3). 화면·API 는 이 인터페이스에만 의존한다.

import type { Rule, RuleFilter, RuleInput, RuleStatus } from "../rules/types";

export interface Repository {
  readonly kind: "local" | "oracle";
  /** 필터·정렬은 applyRuleFilter/sortRules 와 동일한 결과여야 한다. */
  list(filter?: RuleFilter): Promise<Rule[]>;
  /** 없으면 NotFoundError */
  getById(id: string): Promise<Rule>;
  /** 입력을 검증·정규화한다. 위반 → ValidationError, 중복 → DuplicateRuleError */
  create(input: RuleInput): Promise<Rule>;
  /** VERIFIED 에 verifiedBy 가 없으면 ValidationError, 없는 id 는 NotFoundError */
  updateStatus(
    id: string,
    status: RuleStatus,
    verifiedBy?: string | null,
    source?: string | null,
  ): Promise<Rule>;
  /**
   * 삭제(숨김) 또는 복원. 행은 지우지 않고 deletedAt/deleteReason 만 바꾼다.
   * 삭제는 이유 필수(ValidationError), 복원은 이유를 비운다. 없는 id 는 NotFoundError.
   */
  setDeleted(id: string, deleted: boolean, reason?: string | null): Promise<Rule>;
  /** 삭제되지 않은 규칙 수 */
  count(): Promise<number>;
}
