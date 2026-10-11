-- ============================================================================
-- 기존 CVD_RULE 테이블에 "삭제(숨김)" 컬럼을 추가하는 마이그레이션.   ※ 사용자/DBA 가 직접 실행한다.
--   - 이미 01_create_cvd_rule.sql 의 최신판으로 테이블을 만들었다면 실행할 필요 없다.
--   - 재실행 안전: 이미 있으면(ORA-01430 / ORA-02264) 건너뛴다.
--   - 행은 지우지 않는다. 삭제는 DELETED_AT(삭제 시각) 과 DELETE_REASON(삭제 이유)을 채우는 것으로 표현한다.
--   - 실행 예: sqlplus 사용자/암호@접속문자열 @db/02_add_delete_columns.sql
--   - 앱(CVD_STORAGE=oracle)은 이 컬럼이 없으면 조회 자체가 실패하므로, 앱을 올리기 전에 먼저 실행한다.
-- 이 스크립트는 개발 과정에서 실제 DB 에 실행되지 않았다(문법 미검증) — 실행 전 DBA 검토를 권장한다.
-- ============================================================================

DECLARE
  PROCEDURE run_ddl(p_sql IN VARCHAR2) IS
  BEGIN
    EXECUTE IMMEDIATE p_sql;
  EXCEPTION
    WHEN OTHERS THEN
      -- ORA-01430: 추가하려는 열이 이미 있음 / ORA-02264: 이미 사용 중인 제약조건 이름
      IF SQLCODE IN (-1430, -2264) THEN
        NULL;
      ELSE
        RAISE;
      END IF;
  END run_ddl;
BEGIN
  run_ddl('ALTER TABLE CVD_RULE ADD (DELETED_AT TIMESTAMP(3))');
  run_ddl('ALTER TABLE CVD_RULE ADD (DELETE_REASON VARCHAR2(500 CHAR))');
  run_ddl(
    'ALTER TABLE CVD_RULE ADD CONSTRAINT CK_CVD_RULE_DELETED ' ||
    'CHECK (DELETED_AT IS NULL OR DELETE_REASON IS NOT NULL)'
  );
END;
/
