-- ============================================================================
-- 전환 닥터 규칙 저장소 DDL (Oracle)   ※ 이 스크립트는 사용자/DBA 가 직접 실행한다.
--   - 기존 사내 테이블은 건드리지 않는다. 신규 테이블 접두어: CVD_
--   - 재실행 안전: 이미 있으면(ORA-00955 / ORA-01408) 건너뛴다. DROP 은 넣지 않았다(db/99_drop_cvd_rule.sql 참고).
--   - 필요 권한: CREATE TABLE, CREATE INDEX (대상 스키마에서)
--   - 실행 예: sqlplus 사용자/암호@접속문자열 @db/01_create_cvd_rule.sql
-- 이 스크립트는 개발 과정에서 실제 DB 에 실행되지 않았다(문법 미검증) — 실행 전 DBA 검토를 권장한다.
-- ============================================================================

DECLARE
  PROCEDURE run_ddl(p_sql IN VARCHAR2) IS
  BEGIN
    EXECUTE IMMEDIATE p_sql;
  EXCEPTION
    WHEN OTHERS THEN
      -- ORA-00955: 이미 사용 중인 이름 / ORA-01408: 이미 같은 열 목록에 인덱스가 있음
      IF SQLCODE IN (-955, -1408) THEN
        NULL;
      ELSE
        RAISE;
      END IF;
  END run_ddl;
BEGIN
  run_ddl(
    'CREATE TABLE CVD_RULE (' ||
    '  RULE_ID         VARCHAR2(36 CHAR)   NOT NULL,' ||
    '  NEXA_FN         VARCHAR2(100 CHAR)  NOT NULL,' ||
    '  WS_FN           VARCHAR2(100 CHAR),' ||
    '  RULE_TYPE       VARCHAR2(12 CHAR)   NOT NULL,' ||
    '  TARGET_TYPE     VARCHAR2(40 CHAR),' ||
    '  INTENT_NOTE     CLOB,' ||
    '  EXAMPLE_BEFORE  CLOB,' ||
    '  EXAMPLE_AFTER   CLOB,' ||
    '  SRC_REF         VARCHAR2(500 CHAR)  NOT NULL,' ||
    '  RULE_STATUS     VARCHAR2(10 CHAR)   DEFAULT ''PROPOSED'' NOT NULL,' ||
    '  AUTHOR_NAME     VARCHAR2(50 CHAR)   NOT NULL,' ||
    '  VERIFIED_BY     VARCHAR2(50 CHAR),' ||
    '  CREATED_AT      TIMESTAMP(3)        NOT NULL,' ||
    '  UPDATED_AT      TIMESTAMP(3)        NOT NULL,' ||
    '  DELETED_AT      TIMESTAMP(3),' ||
    '  DELETE_REASON   VARCHAR2(500 CHAR),' ||
    '  CONSTRAINT PK_CVD_RULE          PRIMARY KEY (RULE_ID),' ||
    '  CONSTRAINT CK_CVD_RULE_TYPE     CHECK (RULE_TYPE IN (''REPLACE'',''INTENT_DIFF'',''UNSUPPORTED'')),' ||
    '  CONSTRAINT CK_CVD_RULE_STATUS   CHECK (RULE_STATUS IN (''PROPOSED'',''VERIFIED'')),' ||
    '  CONSTRAINT CK_CVD_RULE_WSFN     CHECK (RULE_TYPE = ''UNSUPPORTED'' OR WS_FN IS NOT NULL),' ||
    '  CONSTRAINT CK_CVD_RULE_VERIFIER CHECK (RULE_STATUS <> ''VERIFIED'' OR VERIFIED_BY IS NOT NULL),' ||
    '  CONSTRAINT CK_CVD_RULE_DELETED  CHECK (DELETED_AT IS NULL OR DELETE_REASON IS NOT NULL)' ||
    ')'
  );

  -- 유일성: (함수명, 대상 타입 또는 센티널 '*'). Oracle 은 복합 유니크에서 NULL 을 서로 다른 값으로 보므로
  -- NVL 을 쓴 함수 기반 유니크 인덱스로 (함수명, 타입 미지정) 중복을 막는다. 함수명 조회는 이 인덱스의 선두 컬럼이 커버한다.
  run_ddl(
    'CREATE UNIQUE INDEX UX_CVD_RULE_FN_TGT ON CVD_RULE (NEXA_FN, NVL(TARGET_TYPE, ''*''))'
  );

  -- 웹스퀘어 함수명 조회용 보조 인덱스 (비유니크)
  run_ddl('CREATE INDEX IX_CVD_RULE_WSFN ON CVD_RULE (WS_FN)');
END;
/

-- 참고(미적용): INTENT_NOTE(CLOB)의 "유형별 필수(INTENT_DIFF/UNSUPPORTED 는 설명 필수)" 는 LOB 컬럼에 대한 CHECK 가
-- 허용되지 않을 수 있어 DB 제약으로 넣지 않았다. 앱(서버 검증)이 대신 검증한다. DBA 가 사용 가능 여부를 확인한 뒤 추가할 수 있다.
--
-- 빈 문자열: Oracle 은 '' 를 NULL 로 저장한다. 앱이 선택 항목을 항상 null 로 정규화해서 넣는다.
