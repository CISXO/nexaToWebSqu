import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { TypeBadge } from "@/components/ui";

export const metadata: Metadata = { title: "사용 방법 · 전환 닥터" };

const TOC = [
  { id: "overview", label: "이 도구는 무엇을 하나요" },
  { id: "quick", label: "1분 시작하기" },
  { id: "input", label: "1. 소스 넣기" },
  { id: "read", label: "2. 결과 읽기" },
  { id: "fix", label: "3. 고치기" },
  { id: "output", label: "4. 수정본 가져가기" },
  { id: "rule", label: "5. 규칙 등록" },
  { id: "dictionary", label: "6. 함수 사전" },
  { id: "limits", label: "알아 둘 점" },
];

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-h`} className="scroll-mt-4 rounded border border-slate-300 bg-white p-5">
      <h2 id={`${id}-h`} className="text-lg font-bold text-slate-900">
        {title}
      </h2>
      <div className="mt-3 flex flex-col gap-3 text-sm leading-relaxed text-slate-800">{children}</div>
    </section>
  );
}

function Steps({ children }: { children: ReactNode }) {
  return <ol className="list-decimal space-y-1.5 pl-5">{children}</ol>;
}

function Btn({ children }: { children: ReactNode }) {
  return (
    <kbd className="rounded border border-slate-300 bg-slate-50 px-1.5 py-0.5 font-sans text-xs font-semibold text-slate-800">
      {children}
    </kbd>
  );
}

function Code({ children }: { children: ReactNode }) {
  return <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[13px]">{children}</code>;
}

function Note({ children }: { children: ReactNode }) {
  return (
    <p className="rounded border border-slate-200 bg-slate-50 px-3 py-2 text-slate-700">{children}</p>
  );
}

export default function GuidePage() {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-4 px-4 py-6">
      <div>
        <h1 className="text-xl font-bold">사용 방법</h1>
        <p className="mt-1 text-sm text-slate-600">
          전환 닥터를 처음 쓰는 분을 위한 안내입니다. 화면 순서대로 따라 하면 소스 업로드부터 수정본 받기까지
          한 번에 할 수 있습니다.
        </p>
      </div>

      <nav aria-label="이 페이지의 목차" className="rounded border border-slate-200 bg-white px-4 py-3">
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
          {TOC.map((t) => (
            <li key={t.id}>
              <a href={`#${t.id}`} className="text-blue-700 underline">
                {t.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <Section id="overview" title="이 도구는 무엇을 하나요">
        <p>
          넥사크로에서 웹스퀘어로 전환기를 돌린 뒤에도 <strong>함수 이름이 다르거나, 이름은 바뀌었는데 동작 의미가
          달라지는 곳</strong>이 남습니다. 전환 닥터는 전환된 소스를 올리면 그런 곳을 <strong>줄 번호와 함께 목록</strong>으로
          보여 주고, 팀이 등록해 둔 전환 사례(규칙)를 바로 확인하게 해 줍니다.
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>소스를 통째로 전환하는 도구가 아닙니다. 검출하고 경고하는 도구입니다.</li>
          <li>
            <strong>단순 치환</strong> 항목만 함수 이름 한 곳을 자동으로 바꿔 줍니다. 그 밖의 항목은 사유와 대체안을
            보면서 <strong>직접 고칩니다.</strong>
          </li>
          <li>업로드한 소스는 <strong>브라우저 안에서만</strong> 처리됩니다. 서버로 보내거나 저장하지 않습니다.</li>
        </ul>
      </Section>

      <Section id="quick" title="1분 시작하기">
        <Steps>
          <li>
            상단 메뉴 <Btn>스캔</Btn>에서 <Btn>샘플 불러오기: sample-ws.js</Btn>를 눌러 예시로 먼저 체험해 봅니다.
          </li>
          <li>오른쪽 결과 목록에서 항목을 하나 눌러 보세요. 왼쪽 소스가 그 줄로 이동해 강조됩니다.</li>
          <li>
            <strong>단순 치환</strong> 항목의 <Btn>변경</Btn>을 눌러 미리보기를 보고 <Btn>적용</Btn>합니다.
          </li>
          <li>
            <Btn>복사</Btn> 또는 <Btn>다운로드</Btn>로 수정본을 가져갑니다.
          </li>
        </Steps>
        <Note>내 소스로 할 때는 1번 대신 <Btn>소스 파일 선택</Btn> 또는 <Btn>소스 붙여넣기</Btn>를 쓰면 됩니다.</Note>
      </Section>

      <Section id="input" title="1. 소스 넣기">
        <p>스캔 화면 위쪽 버튼 줄에서 다음 중 편한 방법을 고릅니다.</p>
        <ul className="list-disc space-y-1.5 pl-5">
          <li>
            <Btn>소스 파일 선택</Btn> — 파일을 골라 올립니다. 왼쪽 영역으로 파일을 <strong>끌어다 놓아도</strong> 됩니다.
          </li>
          <li>
            <Btn>소스 붙여넣기</Btn> — 텍스트를 직접 붙여넣고 <strong>형식</strong>(<Code>.js</Code>, <Code>.xml</Code> 등)을
            고른 뒤 <Btn>스캔</Btn>을 누릅니다. 파일 이름이 없으므로 형식 선택이 필요합니다. 마크업이면 형식을
            <Code>.xml</Code>·<Code>.html</Code> 등으로 고르세요.
          </li>
          <li>
            <Btn>샘플 불러오기</Btn> — 마스킹된 예시 소스로 화면을 익힐 때 씁니다.
          </li>
        </ul>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead className="bg-slate-100 text-xs text-slate-700">
              <tr>
                <th scope="col" className="px-3 py-2">형식</th>
                <th scope="col" className="px-3 py-2">스캔 범위</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              <tr>
                <td className="px-3 py-2"><Code>.js</Code> <Code>.txt</Code></td>
                <td className="px-3 py-2">파일 전체</td>
              </tr>
              <tr>
                <td className="px-3 py-2"><Code>.xml</Code> <Code>.xfdl</Code> <Code>.html</Code> <Code>.htm</Code></td>
                <td className="px-3 py-2">
                  <Code>&lt;script&gt;</Code> 블록 안의 스크립트만 (속성값·인라인 이벤트는 제외)
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <Note>크기는 최대 2MB / 20,000줄입니다. 넘으면 안내 문구가 뜨고 스캔하지 않습니다.</Note>
      </Section>

      <Section id="read" title="2. 결과 읽기">
        <p>
          오른쪽 결과 영역 맨 위에 <strong>총 건수</strong>와 유형별 건수, 사용한 규칙 수가 나옵니다. 각 항목에는 줄
          번호, 호출 이름, 그리고 세 가지 배지가 붙습니다.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead className="bg-slate-100 text-xs text-slate-700">
              <tr>
                <th scope="col" className="px-3 py-2">유형 배지</th>
                <th scope="col" className="px-3 py-2">뜻</th>
                <th scope="col" className="px-3 py-2">어떻게 하나요</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              <tr>
                <td className="px-3 py-2"><TypeBadge type="REPLACE" /></td>
                <td className="px-3 py-2">함수 이름만 다르고 쓰임은 같은 경우</td>
                <td className="px-3 py-2"><Btn>변경</Btn>으로 자동 치환하거나 일괄 변경</td>
              </tr>
              <tr>
                <td className="px-3 py-2"><TypeBadge type="INTENT_DIFF" /></td>
                <td className="px-3 py-2">이름은 대응되지만 반환값·동작의 의미가 달라질 수 있는 경우</td>
                <td className="px-3 py-2">사유를 읽고 <Btn>직접 수정</Btn></td>
              </tr>
              <tr>
                <td className="px-3 py-2"><TypeBadge type="UNSUPPORTED" /></td>
                <td className="px-3 py-2">웹스퀘어에 대응 함수가 없는 경우</td>
                <td className="px-3 py-2">다른 방식으로 구현하도록 <Btn>직접 수정</Btn></td>
              </tr>
            </tbody>
          </table>
        </div>
        <ul className="list-disc space-y-1.5 pl-5">
          <li>
            <strong>가능성 있음, 확인 필요</strong> — 수신 객체가 어떤 타입인지 화면만으로는 알 수 없다는 뜻입니다.
            <strong>대상 타입 ○○ 확인</strong>은 규칙에 타입이 지정돼 있어, 그 타입일 때 해당한다는 뜻입니다. 둘 다
            확정이 아니므로 소스를 보고 직접 확인하세요.
          </li>
          <li>
            <strong>제안됨 / 검증됨</strong> — 규칙의 신뢰 상태입니다. 검증됨은 누군가 확인을 마친 규칙입니다.
          </li>
          <li>
            <strong>같은 호출에 후보 N개</strong> — 한 호출에 맞는 규칙이 여러 개라는 뜻입니다. 어느 쪽인지 확인하고 하나씩
            처리하세요.
          </li>
          <li>
            항목의 위쪽(줄 번호 부분)을 누르면 <strong>왼쪽 소스가 그 줄로 이동</strong>합니다. 검출된 줄에는 표시가 붙어
            있습니다.
          </li>
          <li>
            목록 위 <strong>필터</strong>로 유형·확신도를 좁히거나 <strong>검증됨만 보기</strong>를 켤 수 있습니다.
          </li>
        </ul>
      </Section>

      <Section id="fix" title="3. 고치기">
        <h3 className="font-semibold text-slate-900">단순 치환 항목 — 변경</h3>
        <Steps>
          <li>
            항목의 <Btn>변경</Btn>을 누릅니다.
          </li>
          <li>
            <strong>변경 전 줄</strong>(바뀔 함수 이름이 강조됨)과 <strong>변경 후 줄</strong>을 비교합니다. 함수 이름
            한 곳만 바뀌고 인수·줄 수는 그대로입니다.
          </li>
          <li>
            변경 후 줄은 입력 칸이라 <strong>그대로 고칠 수 있습니다.</strong> 줄바꿈은 넣을 수 없습니다(줄 번호가
            밀리기 때문입니다).
          </li>
          <li>
            <Btn>적용</Btn>을 누르면 소스가 바뀌고 <strong>자동으로 다시 스캔</strong>합니다.
          </li>
        </Steps>

        <h3 className="mt-2 font-semibold text-slate-900">의도 다름·미지원 항목 — 직접 수정</h3>
        <p>
          이 항목들은 무엇으로 바꿔야 할지 사람이 판단해야 하므로 자동 치환하지 않습니다. 대신 <Btn>직접 수정</Btn>
          버튼으로 그 줄을 바로 고칠 수 있습니다.
        </p>
        <Steps>
          <li>
            항목의 <Btn>직접 수정</Btn>을 누릅니다. 사유와 참고 대체안이 위에 보입니다.
          </li>
          <li>
            <strong>변경 후 줄</strong> 칸에 원문 줄이 들어 있습니다. 사유를 보면서 원하는 코드로 직접 고칩니다.
          </li>
          <li>
            고친 내용이 있어야 <Btn>적용</Btn>이 켜집니다. 적용하면 그 줄만 바뀌고 자동 재스캔합니다.
          </li>
        </Steps>
        <Note>
          참고 대체안은 말 그대로 참고입니다. 반환 의미가 기존 의도와 같은지는 웹스퀘어 API 문서나 실제 동작으로 확인해
          주세요.
        </Note>

        <h3 className="mt-2 font-semibold text-slate-900">한꺼번에 — 일괄 변경</h3>
        <p>
          <Btn>일괄 변경</Btn>은 위쪽 두 탭으로 나뉩니다. 고른 항목은 <strong>두 탭 모두 한 번에</strong> 적용됩니다.
        </p>
        <ul className="list-disc space-y-1.5 pl-5">
          <li>
            <strong>단순 치환 탭</strong> — 체크한 항목에 자동 치환 결과가 들어 있고, <strong>변경 후 줄을 직접 고칠 수
            있습니다.</strong> 고치면 자동으로 체크됩니다. 대상 타입이 지정된 항목만 처음부터 체크되어 있고, 확인이 더
            필요한 항목은 꺼져 있습니다. 같은 호출에 후보가 여러 개인 항목은 <strong>하나만 선택</strong>할 수 있습니다(하나를
            고르면 나머지 후보는 해제됩니다).
          </li>
          <li>
            <strong>직접 수정 탭</strong> — 의도 다름·미지원 항목입니다. 원문 줄이 들어 있고, <strong>직접 고친 항목만</strong>{" "}
            적용됩니다.
          </li>
          <li>
            아래 <Btn>선택 항목 적용</Btn> 또는 <Btn>적용 후 복사</Btn>를 누릅니다. 한 줄에 적용할 항목이 여러 개인데 직접 고친
            줄이 섞이면 안내 문구가 뜨니, 그 줄에서는 하나만 선택하세요.
          </li>
        </ul>

        <h3 className="mt-2 font-semibold text-slate-900">되돌리기</h3>
        <p>
          <Btn>원본으로 되돌리기</Btn>는 업로드(붙여넣기) 직후의 원문으로 돌아갑니다. 지금까지 한 변경이 모두 사라지니
          주의하세요.
        </p>
      </Section>

      <Section id="output" title="4. 수정본 가져가기">
        <ul className="list-disc space-y-1.5 pl-5">
          <li>
            <Btn>복사</Btn> — 수정본 전체를 클립보드에 복사합니다. Windows 클립보드는 줄바꿈을 CRLF로 바꿀 수 있으니 줄바꿈이
            중요하면 다운로드를 쓰세요.
          </li>
          <li>
            <Btn>다운로드</Btn> — 원본 이름 뒤에 <Code>.fixed</Code>가 붙은 파일로 받습니다. 예: <Code>sample-ws.js</Code>{" "}
            → <Code>sample-ws.fixed.js</Code>. 원본 줄바꿈이 유지되고 UTF-8로 저장됩니다.
          </li>
        </ul>
        <p>
          변경 창의 <Btn>적용 후 복사</Btn>를 쓰면 적용과 동시에 수정본 전체가 복사됩니다. 적용·복사·다운로드가 끝나면 화면 아래에
          알림(토스트)이 잠깐 나타납니다.
        </p>
        <Note>서버에는 아무것도 저장되지 않습니다. 페이지를 닫거나 새로 고치면 작업 내용이 사라지니 먼저 받아 두세요.</Note>
      </Section>

      <Section id="rule" title="5. 규칙 등록 — 해결한 사례 남기기">
        <p>
          문제를 직접 해결했다면 <Link href="/rules/new" className="text-blue-700 underline">규칙 등록</Link>에 남겨 두세요.
          등록한 규칙은 <strong>재시작 없이 바로 다음 스캔부터</strong> 쓰입니다. 그래야 다음 사람이 같은 문제를 다시 찾지
          않습니다.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead className="bg-slate-100 text-xs text-slate-700">
              <tr>
                <th scope="col" className="px-3 py-2">입력 항목</th>
                <th scope="col" className="px-3 py-2">작성 요령</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              <tr>
                <td className="px-3 py-2 font-medium">넥사크로 함수명 <span className="text-red-700">*</span></td>
                <td className="px-3 py-2">예: <Code>getRowCount</Code></td>
              </tr>
              <tr>
                <td className="px-3 py-2 font-medium">유형 <span className="text-red-700">*</span></td>
                <td className="px-3 py-2">단순 치환 / 의도 다름 / 미지원 중 하나</td>
              </tr>
              <tr>
                <td className="px-3 py-2 font-medium">웹스퀘어 대체 함수</td>
                <td className="px-3 py-2">미지원이 아니면 필요합니다.</td>
              </tr>
              <tr>
                <td className="px-3 py-2 font-medium">대상 객체 타입 (선택)</td>
                <td className="px-3 py-2">
                  <Code>dataList</Code>, <Code>dataMap</Code> 등. 같은 함수라도 타입별로 규칙을 따로 둘 수 있습니다.
                </td>
              </tr>
              <tr>
                <td className="px-3 py-2 font-medium">의도 차이 설명</td>
                <td className="px-3 py-2">
                  의도 다름·미지원에서 필요합니다. 확인된 차이만 적고, 확인되지 않은 내용은 &quot;확인 필요&quot;라고 적으세요.
                </td>
              </tr>
              <tr>
                <td className="px-3 py-2 font-medium">예제 코드 (선택)</td>
                <td className="px-3 py-2">넥사크로 / 웹스퀘어 전·후 코드</td>
              </tr>
              <tr>
                <td className="px-3 py-2 font-medium">출처, 등록자 <span className="text-red-700">*</span></td>
                <td className="px-3 py-2">API 문서 URL이나 실동작 확인 화면, 등록자 이름</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="text-xs text-slate-600">* 필수. 같은 함수명과 대상 타입의 규칙이 이미 있으면 등록되지 않습니다.</p>
        <Note>
          새로 등록한 규칙은 <strong>제안됨</strong> 상태입니다. 규칙의 수정 화면은 없으니 입력 내용을 한 번 더
          확인하고 등록하세요. (삭제는 함수 사전 상세 화면에서 할 수 있습니다.)
        </Note>
      </Section>

      <Section id="dictionary" title="6. 함수 사전">
        <p>
          <Link href="/dictionary" className="text-blue-700 underline">함수 사전</Link>은 등록된 규칙을 찾아보는 곳입니다.
          스캔과 상관없이 &quot;이 함수는 웹스퀘어에서 뭘 쓰지?&quot;가 궁금할 때 바로 검색하세요.
        </p>
        <ul className="list-disc space-y-1.5 pl-5">
          <li>
            <strong>함수명 검색</strong>은 부분 일치(대소문자 무시)이며 넥사크로·웹스퀘어 양쪽 이름을 모두 찾습니다.
          </li>
          <li>유형, 상태(제안됨/검증됨), 대상 타입으로 좁힐 수 있습니다.</li>
          <li>표에서 함수명을 누르면 의도 차이 설명과 전/후 예제가 보입니다.</li>
          <li>
            직접 확인해 맞다고 판단한 규칙은 상세 화면에서 <strong>검증됨으로 변경</strong>할 수 있고, 다시 <strong>제안됨으로
            되돌리기</strong>도 됩니다.
          </li>
          <li>
            잘못 등록됐거나 더 이상 쓰지 않는 규칙은 상세 화면의 <strong>삭제</strong> 버튼으로 이유를 남기고 뺄 수 있습니다.
            실제로 지워지지 않고 <Link href="/dictionary/deleted" className="text-blue-700 underline">삭제 목록</Link> 메뉴로
            옮겨지며, 거기서 삭제 이유·삭제일을 확인하고 언제든 <strong>복원</strong>할 수 있습니다.
          </li>
        </ul>
      </Section>

      <Section id="limits" title="알아 둘 점">
        <ul className="list-disc space-y-1.5 pl-5">
          <li>
            검출은 소스 글자를 보고 판단하므로 <strong>오탐(맞지 않는데 검출)과 미탐(놓침)이 있을 수 있습니다.</strong>{" "}
            수신 객체의 실제 타입은 알 수 없기 때문에, 항목마다 소스를 열어 확인하는 것을 기본으로 하세요.
          </li>
          <li>
            처리하지 않는 것: 정규식 리터럴, 템플릿 리터럴 <Code>{"${}"}</Code> 내부, 마크업의 인라인 이벤트 속성, 동적 호출(
            <Code>obj[&quot;fn&quot;]()</Code>), 수신 객체가 없는 호출.
          </li>
          <li>
            등록된 규칙은 대부분 <strong>AI 초안이라 제안됨</strong> 상태입니다. 그대로 믿지 말고 공식 문서나 실동작으로
            확인한 뒤 검증됨으로 바꿔 주세요.
          </li>
          <li>소스는 UTF-8로 읽습니다. 글자가 깨져 보인다는 경고가 뜨면 인코딩을 확인하세요.</li>
          <li>
            헤더 오른쪽 배지는 현재 규칙 저장소(로컬 JSON 또는 Oracle)와 규칙 건수입니다. 오류가 표시되면 배너의{" "}
            <Btn>다시 시도</Btn>를 누르세요.
          </li>
        </ul>
      </Section>
    </div>
  );
}
