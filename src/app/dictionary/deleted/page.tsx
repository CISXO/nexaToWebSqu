import type { Metadata } from "next";
import DeletedDictionaryApp from "@/components/dictionary/DeletedDictionaryApp";

export const metadata: Metadata = { title: "삭제 목록 · 전환 닥터" };

export default function DeletedDictionaryPage() {
  return <DeletedDictionaryApp />;
}
