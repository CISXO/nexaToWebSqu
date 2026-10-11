"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState, type FormEvent, type ReactNode } from "react";
import { ApiClientError, createRule, errorMessage } from "@/lib/client/api";
import { DUPLICATE_RULE_MESSAGE, RULE_TYPE_LABEL, RULE_TYPES, type RuleType } from "@/lib/rules/types";
import { validateRuleInput } from "@/lib/rules/validate";
import { Banner, btnPrimary } from "../ui";

interface FormState {
  nexaFn: string;
  ruleType: RuleType | "";
  wsFn: string;
  targetType: string;
  intentNote: string;
  exampleBefore: string;
  exampleAfter: string;
  source: string;
  author: string;
}

const EMPTY: FormState = {
  nexaFn: "",
  ruleType: "",
  wsFn: "",
  targetType: "",
  intentNote: "",
  exampleBefore: "",
  exampleAfter: "",
  source: "",
  author: "",
};

const inputCls = "w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-sm";

function Field({
  id,
  label,
  required,
  error,
  hint,
  children,
}: {
  id: string;
  label: string;
  required?: boolean;
  error?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-semibold text-slate-800">
        {label}
        {required ? (
          <span className="ml-1 text-red-700" aria-hidden="true">
            *
          </span>
        ) : null}
        {required ? <span className="sr-only"> (필수)</span> : null}
      </label>
      {children}
      {hint ? (
        <p id={`${id}-hint`} className="text-xs text-slate-600">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-xs font-semibold text-red-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export default function RuleForm() {
  const router = useRouter();
  const uid = useId();
  const [form, setForm] = useState<FormState>(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [banner, setBanner] = useState<{ kind: "error" | "warn"; text: string; link?: string } | null>(null);
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const id = (name: string) => `${uid}-${name}`;
  const need = {
    wsFn: form.ruleType === "REPLACE" || form.ruleType === "INTENT_DIFF",
    intentNote: form.ruleType === "INTENT_DIFF" || form.ruleType === "UNSUPPORTED",
  };
  const describe = (name: string, hint?: boolean) =>
    [hint ? `${id(name)}-hint` : "", errors[name] ? `${id(name)}-error` : ""].filter(Boolean).join(" ") ||
    undefined;

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (saving) return;
    setBanner(null);
    // 클라이언트 검증 (서버가 같은 규칙으로 다시 검증한다)
    const checked = validateRuleInput(form);
    if (!checked.ok) {
      setErrors(checked.fields);
      const first = Object.keys(checked.fields)[0];
      if (first) document.getElementById(id(first))?.focus();
      return;
    }
    setErrors({});
    setSaving(true);
    try {
      const rule = await createRule(checked.value as unknown as Record<string, unknown>);
      router.push(`/dictionary?q=${encodeURIComponent(rule.nexaFn)}&created=1`);
    } catch (err) {
      setSaving(false);
      if (err instanceof ApiClientError) {
        if (err.code === "VALIDATION_ERROR" && err.fields) {
          setErrors(err.fields);
          setBanner({ kind: "error", text: "입력값을 확인하세요. 서버 검증에서 거부되었습니다." });
        } else if (err.code === "DUPLICATE_RULE") {
          setBanner({
            kind: "error",
            text: DUPLICATE_RULE_MESSAGE,
            link: `/dictionary?q=${encodeURIComponent(form.nexaFn.trim())}`,
          });
        } else if (err.code === "STORAGE_UNAVAILABLE") {
          setBanner({
            kind: "error",
            text: `${err.message} 입력한 내용은 그대로 남아 있습니다. CVD_STORAGE=local 로 실행하거나 DB 설정을 확인한 뒤 다시 저장하세요.`,
          });
        } else {
          setBanner({ kind: "error", text: err.message });
        }
      } else {
        setBanner({ kind: "error", text: errorMessage(err) });
      }
    }
  };

  const aria = (name: string, hint?: boolean) => ({
    "aria-invalid": errors[name] ? true : undefined,
    "aria-describedby": describe(name, hint),
  });

  return (
    <form onSubmit={onSubmit} noValidate className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-6">
      <div>
        <h1 className="text-xl font-bold">규칙 등록</h1>
        <p className="mt-1 text-sm text-slate-600">
          전환 후 문제를 해결한 경험을 규칙으로 남기면 스캔 화면에서 바로 재사용됩니다. 등록된 규칙의 상태는 항상
          &quot;제안됨&quot;이며, 함수 사전에서 확인한 뒤 &quot;검증됨&quot;으로 올릴 수 있습니다.
        </p>
      </div>

      {banner ? (
        <Banner
          kind={banner.kind}
          action={
            banner.link ? (
              <Link href={banner.link} className="text-blue-700 underline">
                사전에서 기존 규칙 보기
              </Link>
            ) : null
          }
        >
          {banner.text}
        </Banner>
      ) : null}

      <Field id={id("nexaFn")} label="넥사크로 함수명" required error={errors.nexaFn}>
        <input
          id={id("nexaFn")}
          value={form.nexaFn}
          onChange={(e) => set("nexaFn", e.target.value)}
          className={inputCls}
          autoComplete="off"
          spellCheck={false}
          placeholder="예: getRowCount"
          {...aria("nexaFn")}
        />
      </Field>

      <fieldset className="flex flex-col gap-1" aria-describedby={errors.ruleType ? id("ruleType-error") : undefined}>
        <legend className="text-sm font-semibold text-slate-800">
          유형
          <span className="ml-1 text-red-700" aria-hidden="true">
            *
          </span>
          <span className="sr-only"> (필수)</span>
        </legend>
        <div className="flex flex-wrap gap-4">
          {RULE_TYPES.map((t) => (
            <label key={t} className="flex items-center gap-1.5 text-sm">
              <input
                type="radio"
                name={id("ruleType")}
                value={t}
                checked={form.ruleType === t}
                onChange={() => set("ruleType", t)}
              />
              {RULE_TYPE_LABEL[t]}
            </label>
          ))}
        </div>
        <p className="text-xs text-slate-600">
          단순 치환: 이름만 바꾸면 됨 / 의도 다름: 이름은 대응되지만 동작·반환이 다를 수 있음 / 미지원: 대응 기능 없음
        </p>
        {errors.ruleType ? (
          <p id={id("ruleType-error")} role="alert" className="text-xs font-semibold text-red-700">
            {errors.ruleType}
          </p>
        ) : null}
      </fieldset>

      <Field id={id("wsFn")} label="웹스퀘어 대체 함수" required={need.wsFn} error={errors.wsFn}>
        <input
          id={id("wsFn")}
          value={form.wsFn}
          onChange={(e) => set("wsFn", e.target.value)}
          className={inputCls}
          autoComplete="off"
          spellCheck={false}
          placeholder="예: getCount (미지원 유형은 비워도 됨)"
          {...aria("wsFn")}
        />
      </Field>

      <Field
        id={id("targetType")}
        label="대상 객체 타입 (선택)"
        error={errors.targetType}
        hint="비우면 '가능성 있음, 확인 필요'로 표시됩니다. 타입을 적으면 '대상 타입 ○○ 확인'으로 표시됩니다."
      >
        <input
          id={id("targetType")}
          list={id("targetTypeList")}
          value={form.targetType}
          onChange={(e) => set("targetType", e.target.value)}
          className={inputCls}
          autoComplete="off"
          spellCheck={false}
          placeholder="예: dataList"
          {...aria("targetType", true)}
        />
        <datalist id={id("targetTypeList")}>
          <option value="dataMap" />
          <option value="dataList" />
        </datalist>
      </Field>

      <Field id={id("intentNote")} label="의도 차이 설명" required={need.intentNote} error={errors.intentNote}>
        <textarea
          id={id("intentNote")}
          value={form.intentNote}
          onChange={(e) => set("intentNote", e.target.value)}
          rows={4}
          className={inputCls}
          placeholder="확인된 동작 차이나 대안. 확인되지 않은 내용은 '확인 필요'라고 적어 주세요."
          {...aria("intentNote")}
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field id={id("exampleBefore")} label="넥사크로 예제 코드 (선택)" error={errors.exampleBefore}>
          <textarea
            id={id("exampleBefore")}
            value={form.exampleBefore}
            onChange={(e) => set("exampleBefore", e.target.value)}
            rows={4}
            spellCheck={false}
            className={`${inputCls} font-mono`}
            {...aria("exampleBefore")}
          />
        </Field>
        <Field id={id("exampleAfter")} label="웹스퀘어 예제 코드 (선택)" error={errors.exampleAfter}>
          <textarea
            id={id("exampleAfter")}
            value={form.exampleAfter}
            onChange={(e) => set("exampleAfter", e.target.value)}
            rows={4}
            spellCheck={false}
            className={`${inputCls} font-mono`}
            {...aria("exampleAfter")}
          />
        </Field>
      </div>

      <Field id={id("source")} label="출처" required error={errors.source}>
        <input
          id={id("source")}
          value={form.source}
          onChange={(e) => set("source", e.target.value)}
          className={inputCls}
          placeholder="API 문서 URL, 실동작 확인 화면 등"
          {...aria("source")}
        />
      </Field>

      <Field id={id("author")} label="등록자" required error={errors.author}>
        <input
          id={id("author")}
          value={form.author}
          onChange={(e) => set("author", e.target.value)}
          className={inputCls}
          autoComplete="name"
          placeholder="이름"
          {...aria("author")}
        />
      </Field>

      <div>
        <button type="submit" className={btnPrimary} disabled={saving}>
          {saving ? "저장 중…" : "저장"}
        </button>
      </div>
    </form>
  );
}
