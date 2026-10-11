import type { Metadata } from "next";
import RuleForm from "@/components/rules/RuleForm";

export const metadata: Metadata = { title: "규칙 등록 · 전환 닥터" };

export default function NewRulePage() {
  return <RuleForm />;
}
