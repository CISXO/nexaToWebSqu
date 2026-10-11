# 전환 닥터

넥사크로 → 웹스퀘어 전환 후 남는 **함수 차이·의도 차이**를 줄 번호와 함께 목록으로 보여 주고, 팀이 등록한 전환 사례(규칙)를 재사용하게 해 주는 **검출·경고·지식 공유 도구**입니다.

- 소스를 자동으로 "전환"하는 도구가 아닙니다. 검출하고 경고합니다.
- `단순 치환`(REPLACE) 규칙에 한해, 사용자가 항목별로 확인한 **함수 이름 1개**만 바꿔 줍니다. `의도 다름`·`미지원` 항목은 **절대 자동 변경하지 않으며**, 대신 **[직접 수정]** 으로 사용자가 그 줄을 직접 고칠 수 있습니다.
- 업로드한 소스는 **브라우저 안에서만** 처리됩니다. 서버로 전송·저장·로깅하지 않습니다. (서버에는 소스를 받는 API가 없습니다.)
- 런타임에 AI/외부 API를 호출하지 않습니다.

## 1. 필요 환경

| 항목 | 값 |
|---|---|
| Node.js | **20.9 이상** (Next.js 16 요구 사항. 22 LTS 권장) |
| 브라우저 | 최신 Chrome / Edge |
| DB | **필요 없음** (기본은 로컬 JSON 저장소) |
| 포트 | 기본 3000 |

## 2. 설치·실행 (명령 2개)

```powershell
npm install
npm run dev
```

브라우저에서 <http://localhost:3000> 을 엽니다. `.env.local`도, DB도 필요 없습니다.

> `npm install` 중 `npm warn allow-scripts 3 packages have install scripts not yet covered by allowScripts`(esbuild, oracledb, unrs-resolver) 경고가 나올 수 있습니다. 경고일 뿐이며 승인하지 않아도 설치·`lint`·`build`·`dev`·`npm run check` 가 모두 정상 동작함을 확인했습니다(`.env.local` 없는 새 복사본에서 검증). 사내 정책상 승인이 필요하면 `npm approve-scripts` 로 검토하세요.

Windows 에서는 `start.cmd` 더블클릭으로도 실행됩니다(`node_modules`가 없으면 `npm install` 후 기동).

운영 모드: `npm run build` → `npm start` (같은 포트).

> 인증이 없으므로 **로컬 PC 또는 신뢰된 사내망에서만** 실행하세요. 외부 공개 금지.

## 3. 2분 시연 순서 (마스킹 샘플)

1. `/` 스캔 화면에서 **[샘플 불러오기: sample-ws.js]** 를 누릅니다.
2. 우측 요약을 확인합니다: **총 15건 · 의도 다름 6 · 단순 치환 8 · 미지원 1**.
3. 결과 목록에서 **25줄** 항목을 클릭합니다 → 좌측 소스가 25줄로 이동하고 강조됩니다.
4. **41줄** 항목의 **[변경]** → 미리보기(변경 전/후 줄) 확인 → **[적용]** (총 14건으로 줄어듭니다).
5. **[복사]** 를 누르고 메모장에 붙여넣습니다. (**[다운로드]** 는 `sample-ws.fixed.js`)
6. 상단 **함수 사전**에서 `getRowCount` 를 검색합니다.

추가로 볼 만한 것: **[일괄 변경]**(탭 2개: 단순 치환 / 직접 수정. 41줄만 기본 선택, 17줄은 경고와 함께 미체크, 후보 2개인 11·35·36줄은 하나만 선택 가능, 변경 후 줄은 모두 직접 수정 가능, **[적용 후 복사]**), 자동 변경이 안 되는 항목(의도 다름·미지원)의 **[직접 수정]**, 완료 알림 토스트, 규칙 등록(`/rules/new`) 후 재시작 없이 바로 스캔에 반영되는 것, 사용 설명(`/guide`).

## 4. 화면

| 경로 | 내용 |
|---|---|
| `/` | 스캔: 소스 업로드/샘플 → 결과 목록 → 줄 이동 → 변경(diff) → 복사/다운로드 |
| `/rules/new` | 규칙 등록 (서버에서 다시 검증, 중복 거부) |
| `/dictionary` | 함수 매핑 사전: 검색·필터·상세·상태 변경(제안됨↔검증됨) |
| `/guide` | 사용 방법: 소스 넣기 → 결과 읽기 → 고치기 → 수정본 받기, 규칙 등록·함수 사전 안내 |

지원 입력: `.js .txt` (파일 전체) / `.xml .xfdl .html .htm` (`<script>` 블록 내용만). 최대 2MB / 20,000줄.

## 5. 자체 검증 명령

```powershell
npm run lint            # ESLint
npm run build           # 프로덕션 빌드
npm run check:sample    # 샘플 소스 스캔 결과를 기획서 정답표와 대조 (일치 시 종료 코드 0)
npm run check:seed      # 시드 규칙 점검 (50~100건, 전부 제안됨, REF-01~06 고정값 등)
npm run test:repo       # 저장소 어댑터 계약 시험 (로컬 JSON 어댑터, 임시 폴더 사용)
npm run check           # 위 세 가지를 한 번에
npm run bench:scan      # 스캔 계산 시간 측정 (렌더링 제외)
```

`check:sample` 의 기대값은 `scripts/sample-expected.json` (기획서 정답표와 동일)입니다.

## 6. 저장소와 Oracle 전환

규칙은 `Repository` 인터페이스 뒤에서 저장됩니다.

| 모드 | 설정 | 저장 위치 |
|---|---|---|
| **로컬 JSON (기본)** | 설정 없음 (또는 `CVD_STORAGE=local`) | 첫 실행 시 `data/rules.seed.json` → `data/rules.local.json` 로 복사해 사용 (`.gitignore` 대상). 쓰기는 임시 파일 작성 후 교체(원자적). 파일이 깨지면 덮어쓰지 않고 오류를 표시합니다. |
| Oracle | `CVD_STORAGE=oracle` + 접속 변수 | 전용 테이블 `CVD_RULE` (기존 사내 테이블은 건드리지 않음) |

화면 헤더 오른쪽 배지가 현재 저장소("로컬 JSON" / "Oracle")를 보여 줍니다.
`ORACLE_*` 변수가 있어도 `CVD_STORAGE=oracle` 이 아니면 Oracle 을 쓰지 않습니다. Oracle 접속에 실패해도 조용히 로컬로 바뀌지 않고, 화면에 배너(원인·해결 방법)와 [다시 시도]가 표시됩니다.

### Oracle 로 전환하는 순서 (사용자/DBA 가 실행)

1. DBA 가 `db/01_create_cvd_rule.sql` 을 실행합니다 (테이블·제약·인덱스 생성, 재실행 안전, DROP 없음). 롤백용 `db/99_drop_cvd_rule.sql` 은 전부 주석 처리되어 있습니다.
2. (선택) 기존 JSON 규칙을 Oracle 로 이관합니다. 기본은 **드라이런**입니다.
   ```powershell
   npx tsx --env-file=.env.local db/import-json-to-oracle.ts            # 드라이런: 건수만 출력
   npx tsx --env-file=.env.local db/import-json-to-oracle.ts --apply    # 실제 반영 (멱등: 다시 실행해도 늘지 않음)
   ```
   `npm run db:import -- --apply` 도 쓸 수 있으나 환경 변수를 셸에 직접 설정한 경우에 한합니다. 입력 파일은 기본 `data/rules.local.json`(없으면 시드)이며 첫 인자로 경로를 줄 수 있습니다. `--update-status` 를 붙이면 이미 있는 규칙의 상태/검증자도 갱신합니다.
3. `.env.local` 에 `CVD_STORAGE=oracle`, `ORACLE_USER`, `ORACLE_PASSWORD`, `ORACLE_CONNECT_STRING` 을 설정하고 다시 기동합니다. (`.env.example` 참고. 값은 저장소에 올리지 마세요.)
4. 헤더 배지가 "Oracle" 인지 확인합니다.
5. Oracle 어댑터 계약 시험(선택): `CVD_STORAGE=oracle` 과 접속 변수를 설정한 뒤 `npm run test:repo -- --oracle`. 시험 행(`cvdCt…`)을 만들고 종료 시 삭제를 시도합니다.

되돌리기: `CVD_STORAGE` 를 지우고 재기동하면 로컬 JSON 으로 돌아갑니다.

## 7. 환경 변수 (이름만)

| 이름 | 용도 |
|---|---|
| `CVD_STORAGE` | `local`(기본) / `oracle` |
| `CVD_DATA_DIR` | 로컬 JSON 폴더 재지정 (기본 `data/`) |
| `ORACLE_USER`, `ORACLE_PASSWORD`, `ORACLE_CONNECT_STRING` | `CVD_STORAGE=oracle` 일 때만 필요 |

## 8. 오탐 정책과 알려진 한계

- 수신 객체의 타입은 정적으로 알 수 없으므로 **확정 표현을 쓰지 않습니다.** 타입이 지정되지 않은 규칙은 `가능성 있음, 확인 필요`, 지정된 규칙은 `대상 타입 ○○ 확인` 으로 표시합니다. 색만이 아니라 텍스트로도 구분됩니다.
- 같은 호출에 후보 규칙이 여러 개면 각각 별도 항목으로 보이고("같은 호출에 후보 N개"), 일괄 변경에서는 기본 선택하지 않으며 후보 중 하나만 선택할 수 있습니다(확인 후 선택).
- 처리하지 않는 것: 정규식 리터럴, 템플릿 리터럴 `${}` 내부, 마크업의 인라인 이벤트 속성(`ev:onclick="..."` 등)·속성값, 동적 호출(`obj["fn"]()`), 수신부 없는 호출(`fn()`), `(` 없는 참조.
- 소스 인코딩은 UTF-8 로 읽습니다. 깨짐이 의심되면 경고가 뜨고, 수정본은 UTF-8 로 저장됩니다.
- Windows 클립보드는 줄바꿈을 CRLF 로 바꿔 전달할 수 있습니다. 줄바꿈을 그대로 유지해야 하면 **[다운로드]** 를 쓰세요(원본 줄바꿈 유지).
- 규칙 수정·삭제 화면은 없습니다. 잘못 등록한 규칙은 DBA 또는 `data/rules.local.json` 직접 수정으로 정정하고, 상태 `제안됨`으로 위험을 낮춥니다.
- 시드 규칙 63건은 모두 **AI 초안(공식 문서 미대조)** 이며 `제안됨` 입니다. `demo*` 함수(REF-02~06)는 평가용 가상 이름이고, REF-01(`getRowCount`)의 의미는 미검증입니다. 확인한 뒤 함수 사전에서 [검증됨으로 변경] 하세요.

## 9. 보안

- 업로드 소스·콘솔 로그: 서버로 나가지 않음, 서버 로그에 남지 않음, `localStorage`/쿠키에도 저장하지 않음.
- 모든 소스·규칙 필드는 텍스트로만 렌더링(HTML 해석 없음).
- 규칙 API 입력은 서버에서 다시 검증하며 본문은 100KB 로 제한됩니다. Oracle SQL 은 바인드 변수만 사용합니다.
- 접속 정보는 `process.env` 로만 읽고 화면·로그에 출력하지 않습니다(누락 시 변수 **이름**만 안내).

## 10. 제출 ZIP 체크리스트

압축 전에 다음을 확인하세요.

- [ ] 제외: `node_modules/`, `.next/`, `.env.local`(및 모든 `.env*` 실값 파일), `data/rules.local.json`
- [ ] 포함: `data/rules.seed.json`, `data/recipes.json`, `public/samples/`, `db/`, `scripts/`, `.env.example`
- [ ] 저장소에 접속 정보·비밀번호·사내 실제 소스가 없다
- [ ] 새 폴더에 풀어 `npm install` → `npm run dev` 로 기동된다

## 11. 폴더 구조

```
src/lib/rules/        규칙 타입·검증(정규화)·필터 (서버·클라이언트 공용 순수 함수)
src/lib/scanner/      스캐너 코어 (순수 함수: 마스킹, 스크립트 추출, 호출 매칭, 규칙 매칭)
src/lib/diff/         변경 로직 (순수 함수: 토큰 치환, 미리보기, 일괄 변경 목록)
src/lib/repository/   Repository 인터페이스 + 로컬 JSON 어댑터 + Oracle 어댑터 + 선택기
src/lib/oracle.ts     Oracle 연결 풀 (지연 로딩)
src/app/api/          health, rules(GET/POST), rules/[id], rules/[id]/status, recipes
src/app/ , src/components/   화면
data/                 rules.seed.json(시드), recipes.json
db/                   Oracle DDL, 롤백(주석), JSON→Oracle 가져오기
scripts/              check-sample / check-seed / contract-test / bench-scan
public/samples/       마스킹 샘플 소스 (sample-ws.js, sample-ws.xml)
```

기술 스택: Next.js 16 (App Router) · React 19 · TypeScript(strict) · Tailwind 4 · oracledb 7. 개발 의존성 `tsx` 는 `npm run check*`·DB 스크립트 실행용입니다.
# nexaToWebSqu
