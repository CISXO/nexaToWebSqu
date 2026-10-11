import type { Metadata } from "next";
import DictionaryApp from "@/components/dictionary/DictionaryApp";

export const metadata: Metadata = { title: "함수 사전 · 전환 닥터" };

export default async function DictionaryPage({ searchParams }: PageProps<"/dictionary">) {
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q : "";
  const created = params.created === "1";
  return <DictionaryApp initialQuery={q} justCreated={created} />;
}
