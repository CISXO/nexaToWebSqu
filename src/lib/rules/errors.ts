// 저장소·검증 계층 공용 오류 클래스. 메시지에 접속 정보·스택·소스를 넣지 않는다.

export class ValidationError extends Error {
  readonly fields: Record<string, string>;
  constructor(fields: Record<string, string>, message = "입력값이 올바르지 않습니다.") {
    super(message);
    this.name = "ValidationError";
    this.fields = fields;
  }
}

export class DuplicateRuleError extends Error {
  readonly existingId: string | null;
  constructor(existingId: string | null = null) {
    super("이미 같은 함수명과 대상 객체 타입으로 등록된 규칙이 있습니다.");
    this.name = "DuplicateRuleError";
    this.existingId = existingId;
  }
}

export class NotFoundError extends Error {
  constructor(message = "규칙을 찾을 수 없습니다.") {
    super(message);
    this.name = "NotFoundError";
  }
}

/** 저장소 접근 실패(Oracle 연결 불가, 로컬 파일 손상, 잘못된 CVD_STORAGE 값 등). */
export class StorageUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StorageUnavailableError";
  }
}
