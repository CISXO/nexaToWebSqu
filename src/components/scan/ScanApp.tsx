"use client";

import { useMemo, useRef, useState, type DragEvent } from "react";
import { buildBulkItems, fixedFileName, toChangeRequest } from "@/lib/diff/apply";
import { ALLOWED_EXTENSIONS, isAllowedFileName, isMarkupFileName } from "@/lib/scanner/extract";
import { countLines, splitLines } from "@/lib/scanner/lines";
import { scanSource } from "@/lib/scanner/scan";
import type { Finding, ScanResult } from "@/lib/scanner/types";
import { errorMessage, fetchRules } from "@/lib/client/api";
import type { Rule, RuleType } from "@/lib/rules/types";
import { RULE_TYPE_LABEL } from "@/lib/rules/types";
import BulkModal from "./BulkModal";
import ChangeModal from "./ChangeModal";
import FindingList from "./FindingList";
import SourceViewer from "./SourceViewer";
import { Banner, btn, btnPrimary } from "../ui";
import { useToast } from "../Toast";
import Link from "next/link";

const MAX_BYTES = 2 * 1024 * 1024;
const MAX_LINES = 20000;
const SAMPLES = ["sample-ws.js", "sample-ws.xml"] as const;

interface Source {
  fileName: string;
  original: string;
  text: string;
}

type Modal = { kind: "change"; finding: Finding } | { kind: "bulk" } | null;

export default function ScanApp() {
  const [source, setSource] = useState<Source | null>(null);
  const [rules, setRules] = useState<Rule[] | null>(null);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ message: string; retry: boolean } | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const toast = useToast();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeLine, setActiveLine] = useState<number | null>(null);
  const [scrollTick, setScrollTick] = useState(0);
  const [modal, setModal] = useState<Modal>(null);
  const [typeFilter, setTypeFilter] = useState<"ALL" | RuleType>("ALL");
  const [confFilter, setConfFilter] = useState<"ALL" | "CHECK" | "TYPED">("ALL");
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [pasteExt, setPasteExt] = useState<string>(".js");
  const fileInput = useRef<HTMLInputElement>(null);

  const lines = useMemo(() => (source ? splitLines(source.text) : []), [source]);
  const markerLines = useMemo(
    () => new Set((result?.findings ?? []).map((f) => f.line)),
    [result],
  );
  const bulkItems = useMemo(() => buildBulkItems(result?.findings ?? []), [result]);
  /** 자동 변경 대상이 아닌 항목: 일괄 변경 창에서 직접 수정할 수 있다. */
  const manualFindings = useMemo(
    () => (result?.findings ?? []).filter((f) => toChangeRequest(f) === null),
    [result],
  );

  const visible = useMemo(() => {
    const all = result?.findings ?? [];
    return all.filter(
      (f) =>
        (typeFilter === "ALL" || f.ruleType === typeFilter) &&
        (confFilter === "ALL" || f.confidence === confFilter) &&
        (!verifiedOnly || f.ruleStatus === "VERIFIED"),
    );
  }, [result, typeFilter, confFilter, verifiedOnly]);

  // ---- 스캔 ----
  const runScan = (fileName: string, text: string, ruleList: Rule[]) => {
    setResult(scanSource({ fileName, text, rules: ruleList }));
    setActiveId(null);
    setActiveLine(null);
  };

  /** 규칙을 조회한 뒤 스캔한다. 소스는 브라우저 안에서만 처리된다. */
  const startScan = async (fileName: string, text: string) => {
    setBusy(true);
    setError(null);
    try {
      const fetched = await fetchRules();
      setRules(fetched);
      const scanned = scanSource({ fileName, text, rules: fetched });
      setResult(scanned);
      setActiveId(null);
      setActiveLine(null);
      toast(`스캔 완료되었습니다. (총 ${scanned.summary.total}건)`);
    } catch (e) {
      setResult(null);
      setError({
        message: `규칙을 불러오지 못했습니다: ${errorMessage(e)}`,
        retry: true,
      });
    } finally {
      setBusy(false);
    }
  };

  const acceptSource = async (fileName: string, text: string) => {
    setWarning(
      text.includes("�")
        ? "인코딩이 UTF-8이 아닐 수 있습니다. 수정본은 UTF-8로 저장됩니다."
        : null,
    );
    setSource({ fileName, original: text, text });
    setModal(null);
    // 파일·끌어놓기·샘플·붙여넣기 어느 경로든 소스가 들어오면 붙여넣기 패널을 닫아 뷰어가 보이게 한다.
    setPasteOpen(false);
    await startScan(fileName, text);
  };

  const loadFile = async (file: File) => {
    setError(null);
    if (!isAllowedFileName(file.name)) {
      setError({
        message: `허용하지 않는 파일 형식입니다. ${ALLOWED_EXTENSIONS.join(" ")} 파일만 올릴 수 있습니다.`,
        retry: false,
      });
      return;
    }
    if (file.size === 0) {
      setError({ message: "내용이 없는 파일입니다.", retry: false });
      return;
    }
    if (file.size > MAX_BYTES) {
      setError({ message: "파일이 너무 큽니다(최대 2MB / 20,000줄).", retry: false });
      return;
    }
    setBusy(true);
    let text: string;
    try {
      text = await file.text();
    } catch (e) {
      setBusy(false);
      setError({ message: `파일을 읽지 못했습니다: ${errorMessage(e)}`, retry: false });
      return;
    }
    if (text.trim() === "") {
      setBusy(false);
      setError({ message: "내용이 없는 파일입니다.", retry: false });
      return;
    }
    if (countLines(text) > MAX_LINES) {
      setBusy(false);
      setError({ message: "파일이 너무 큽니다(최대 2MB / 20,000줄).", retry: false });
      return;
    }
    await acceptSource(file.name, text);
  };

  /** 붙여넣은 텍스트도 파일 업로드와 같은 검증·스캔 경로를 탄다. 브라우저 안에서만 처리된다. */
  const submitPaste = async () => {
    setError(null);
    if (pasteText.trim() === "") {
      setError({ message: "붙여넣은 내용이 없습니다.", retry: false });
      return;
    }
    if (new TextEncoder().encode(pasteText).length > MAX_BYTES || countLines(pasteText) > MAX_LINES) {
      setError({ message: "내용이 너무 큽니다(최대 2MB / 20,000줄).", retry: false });
      return;
    }
    await acceptSource(`pasted${pasteExt}`, pasteText);
    setPasteText("");
  };

  const openPaste = () => {
    setError(null);
    setPasteOpen(true);
  };

  const loadSample = async (name: string) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/samples/${name}`, { cache: "no-store" });
      if (!res.ok) throw new Error(`샘플을 불러오지 못했습니다 (HTTP ${res.status}).`);
      await acceptSource(name, await res.text());
    } catch (e) {
      setBusy(false);
      setError({ message: errorMessage(e), retry: false });
    }
  };

  const retry = async () => {
    if (source) await startScan(source.fileName, source.text);
  };

  // ---- 변경 ----
  /** 적용 완료 후 자동 재스캔한다. copy 가 true 면 이어서 수정본 전체를 복사한다. */
  const handleApplied = (newText: string, message: string, alsoCopy: boolean) => {
    if (!source) return;
    setSource({ ...source, text: newText });
    if (rules) runScan(source.fileName, newText, rules);
    setModal(null);
    toast(message);
    // 클릭 동작 안에서 바로 호출해야 클립보드 권한이 유지된다.
    if (alsoCopy) void copyText(newText);
  };

  const revert = () => {
    if (!source) return;
    setSource({ ...source, text: source.original });
    if (rules) runScan(source.fileName, source.original, rules);
    setModal(null);
    toast("원본으로 되돌렸습니다.");
  };

  const copyText = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast("복사되었습니다.");
    } catch {
      toast("클립보드 권한이 없어 복사하지 못했습니다. [다운로드]를 이용하세요.", "error");
    }
  };

  const copy = () => {
    if (source) void copyText(source.text);
  };

  const download = () => {
    if (!source) return;
    const blob = new Blob([source.text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fixedFileName(source.fileName);
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast(`${fixedFileName(source.fileName)} 다운로드되었습니다.`);
  };

  const select = (f: Finding) => {
    setActiveId(f.id);
    setActiveLine(f.line);
    setScrollTick((t) => t + 1);
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void loadFile(file);
  };

  const changed = source ? source.text !== source.original : false;
  const summary = result?.summary;

  return (
    <div className="mx-auto flex w-full max-w-[1600px] flex-1 flex-col gap-3 px-4 py-4">
      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={fileInput}
          type="file"
          accept={ALLOWED_EXTENSIONS.join(",")}
          className="hidden"
          data-testid="file-input"
          aria-label="소스 파일 선택"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) void loadFile(file);
          }}
        />
        <button type="button" className={btnPrimary} disabled={busy} onClick={() => fileInput.current?.click()}>
          소스 파일 선택
        </button>
        <button type="button" className={btn} disabled={busy} onClick={openPaste} data-testid="paste-open">
          소스 붙여넣기
        </button>
        {SAMPLES.map((name) => (
          <button key={name} type="button" className={btn} disabled={busy} onClick={() => void loadSample(name)}>
            샘플 불러오기: {name}
          </button>
        ))}
        {source ? (
          <span className="text-sm text-slate-700" data-testid="file-info">
            <strong>{source.fileName}</strong> · {lines.length}줄
          </span>
        ) : null}
        <span className="ml-auto flex flex-wrap gap-2">
          <button type="button" className={btn} disabled={busy || !source || !changed} onClick={revert}>
            원본으로 되돌리기
          </button>
          <button
            type="button"
            className={btn}
            disabled={busy || !source || (bulkItems.length === 0 && manualFindings.length === 0)}
            onClick={() => setModal({ kind: "bulk" })}
          >
            일괄 변경
          </button>
          <button type="button" className={btn} disabled={busy || !source} onClick={copy}>
            복사
          </button>
          <button type="button" className={btn} disabled={busy || !source} onClick={download}>
            다운로드
          </button>
        </span>
      </div>

      {error ? (
        <Banner
          kind="error"
          action={
            error.retry ? (
              <button type="button" className={btn} onClick={() => void retry()} disabled={busy}>
                다시 시도
              </button>
            ) : null
          }
        >
          {error.message}
          {error.retry ? " 저장소 설정을 확인하거나 CVD_STORAGE=local 로 실행하세요." : ""}
        </Banner>
      ) : null}
      {warning ? <Banner kind="warn">{warning}</Banner> : null}
      {busy ? (
        <p role="status" className="text-sm text-slate-600">
          처리 중… (파일은 서버로 전송되지 않습니다)
        </p>
      ) : null}

      <div className="grid flex-1 grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]" style={{ minHeight: "60vh" }}>
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          className={`flex h-[34vh] min-h-64 min-w-0 flex-col rounded md:h-[calc(100vh-13rem)] ${dragOver ? "ring-2 ring-blue-400" : ""}`}
          data-testid="drop-zone"
        >
          {pasteOpen ? (
            <div
              className="flex flex-1 flex-col gap-2 rounded border border-slate-300 bg-white p-3"
              data-testid="paste-panel"
            >
              <label htmlFor="paste-text" className="text-sm font-semibold text-slate-800">
                소스 붙여넣기
              </label>
              <textarea
                id="paste-text"
                data-testid="paste-text"
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                spellCheck={false}
                autoFocus
                placeholder="여기에 소스(JS, XML 등)를 붙여넣으세요"
                className="min-h-64 flex-1 resize-y rounded border border-slate-300 p-2 font-mono text-sm"
              />
              <div className="flex flex-wrap items-center gap-2">
                <label htmlFor="paste-ext" className="text-sm">
                  형식
                </label>
                <select
                  id="paste-ext"
                  data-testid="paste-ext"
                  value={pasteExt}
                  onChange={(e) => setPasteExt(e.target.value)}
                  className="rounded border border-slate-300 px-1 py-1 text-sm"
                >
                  {ALLOWED_EXTENSIONS.map((ext) => (
                    <option key={ext} value={ext}>
                      {ext}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className={btnPrimary}
                  disabled={busy || pasteText.trim() === ""}
                  onClick={() => void submitPaste()}
                  data-testid="paste-submit"
                >
                  스캔
                </button>
                <button type="button" className={btn} onClick={() => setPasteOpen(false)}>
                  취소
                </button>
                <span className="text-xs text-slate-600">
                  붙여넣은 내용은 브라우저 안에서만 처리되며 서버로 전송·저장되지 않습니다. (최대 2MB / 20,000줄)
                </span>
              </div>
            </div>
          ) : source ? (
            <div className="min-h-0 flex-1">
              <SourceViewer
                lines={lines}
                markerLines={markerLines}
                activeLine={activeLine}
                scrollTick={scrollTick}
              />
            </div>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 rounded border-2 border-dashed border-slate-300 bg-white p-8 text-center">
              <p className="text-base font-semibold text-slate-800">전환기가 만든 소스 파일을 올려 주세요</p>
              <p className="text-sm text-slate-600">
                [소스 파일 선택]을 누르거나 파일을 여기로 끌어다 놓으세요. [소스 붙여넣기]로 텍스트를 직접 넣을 수도 있습니다. 허용 형식:{" "}
                {ALLOWED_EXTENSIONS.join(" ")} (최대 2MB / 20,000줄)
              </p>
              <p className="text-sm text-slate-600">
                파일은 브라우저 안에서만 처리되며 서버로 전송·저장되지 않습니다.
              </p>
            </div>
          )}
          <p className="mt-1 text-xs text-slate-500">
            {source && isMarkupFileName(source.fileName)
              ? "마크업 파일은 <script> 블록 안의 스크립트만 스캔합니다(속성값·인라인 이벤트는 제외). "
              : ""}
            알려진 한계: 정규식 리터럴, 템플릿 ${"{}"} 내부, 인라인 이벤트 속성, 동적 호출(obj[&quot;fn&quot;]())은 처리하지 않습니다.
          </p>
        </div>

        <section
          id="finding-panel"
          tabIndex={-1}
          aria-label="스캔 결과"
          className="flex h-[34vh] min-h-64 min-w-0 flex-col gap-3 overflow-y-auto outline-none md:h-[calc(100vh-13rem)]"
        >
          {!result ? (
            <div className="rounded border border-slate-300 bg-white p-6 text-center text-sm text-slate-600">
              스캔 결과가 여기 표시됩니다.
            </div>
          ) : (
            <>
              <div
                data-testid="summary"
                className="rounded border border-slate-300 bg-white px-3 py-2 text-sm"
              >
                <strong>총 {summary!.total}건</strong> · 의도 다름 {summary!.byType.INTENT_DIFF} · 단순 치환{" "}
                {summary!.byType.REPLACE} · 미지원 {summary!.byType.UNSUPPORTED}
                <span className="block text-xs text-slate-600">
                  사용 규칙 {summary!.ruleCount}건 · {summary!.lineCount}줄 · 스캔 {summary!.elapsedMs}ms
                </span>
              </div>

              {summary!.ruleCount === 0 ? (
                <div className="rounded border border-slate-300 bg-white p-4 text-sm">
                  등록된 규칙이 없습니다.{" "}
                  <Link href="/rules/new" className="text-blue-700 underline">
                    [규칙 등록]
                  </Link>
                  에서 추가하세요.
                </div>
              ) : summary!.total === 0 ? (
                <div className="rounded border border-slate-300 bg-white p-4 text-sm">
                  검출된 항목이 없습니다. (규칙 {summary!.ruleCount}건, 스캔 범위{" "}
                  {isMarkupFileName(result.fileName) ? "<script> 블록" : "파일 전체"} {summary!.lineCount}줄)
                </div>
              ) : (
                <>
                  <fieldset className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded border border-slate-200 bg-white px-3 py-2 text-sm">
                    <legend className="px-1 text-xs text-slate-500">필터</legend>
                    <label className="flex items-center gap-1">
                      유형
                      <select
                        value={typeFilter}
                        onChange={(e) => setTypeFilter(e.target.value as "ALL" | RuleType)}
                        className="rounded border border-slate-300 px-1 py-0.5"
                      >
                        <option value="ALL">전체</option>
                        <option value="REPLACE">{RULE_TYPE_LABEL.REPLACE}</option>
                        <option value="INTENT_DIFF">{RULE_TYPE_LABEL.INTENT_DIFF}</option>
                        <option value="UNSUPPORTED">{RULE_TYPE_LABEL.UNSUPPORTED}</option>
                      </select>
                    </label>
                    <label className="flex items-center gap-1">
                      확신도
                      <select
                        value={confFilter}
                        onChange={(e) => setConfFilter(e.target.value as "ALL" | "CHECK" | "TYPED")}
                        className="rounded border border-slate-300 px-1 py-0.5"
                      >
                        <option value="ALL">전체</option>
                        <option value="CHECK">가능성 있음, 확인 필요</option>
                        <option value="TYPED">대상 타입 지정</option>
                      </select>
                    </label>
                    <label className="flex items-center gap-1">
                      <input
                        type="checkbox"
                        checked={verifiedOnly}
                        onChange={(e) => setVerifiedOnly(e.target.checked)}
                      />
                      검증됨만 보기
                    </label>
                    <span className="text-xs text-slate-600">표시 {visible.length}건</span>
                  </fieldset>
                  {visible.length === 0 ? (
                    <div className="rounded border border-slate-300 bg-white p-4 text-sm">
                      필터 조건에 맞는 항목이 없습니다.
                    </div>
                  ) : (
                    <FindingList
                      findings={visible}
                      activeId={activeId}
                      onSelect={select}
                      onChange={(f) => setModal({ kind: "change", finding: f })}
                    />
                  )}
                </>
              )}
            </>
          )}
        </section>
      </div>

      {modal?.kind === "change" && source ? (
        <ChangeModal
          finding={modal.finding}
          text={source.text}
          onApply={handleApplied}
          onClose={() => setModal(null)}
        />
      ) : null}
      {modal?.kind === "bulk" && source ? (
        <BulkModal
          items={bulkItems}
          manualFindings={manualFindings}
          text={source.text}
          onApply={handleApplied}
          onClose={() => setModal(null)}
        />
      ) : null}
    </div>
  );
}
