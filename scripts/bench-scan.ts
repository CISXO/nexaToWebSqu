// npm run bench:scan — 스캔 계산 시간 측정 (렌더링 제외, 규칙 100건 기준). plan.md 6.6 목표: 1,000줄 <=300ms, 5,000줄 <=1s, 20,000줄 <=4s
import { readFileSync } from "node:fs";
import path from "node:path";
import { scanSource } from "../src/lib/scanner/scan";
import type { Rule } from "../src/lib/rules/types";

const seed = JSON.parse(readFileSync(path.join(process.cwd(), "data", "rules.seed.json"), "utf8")) as { rules: Rule[] };
const rules: Rule[] = [...seed.rules];
for (let i = 0; rules.length < 100; i++) {
  rules.push({ ...seed.rules[0], id: `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`, nexaFn: `benchFn${i}`, wsFn: `benchWs${i}`, ruleType: "REPLACE", targetType: null });
}
const sample = readFileSync(path.join(process.cwd(), "public", "samples", "sample-ws.js"), "utf8");
const goals: Record<number, number> = { 1000: 300, 5000: 1000, 20000: 4000 };
let ok = true;
for (const lines of [1000, 5000, 20000]) {
  const text = sample.repeat(Math.ceil(lines / 41)).split("\n").slice(0, lines).join("\n");
  const runs: number[] = [];
  for (let i = 0; i < 5; i++) {
    const t = performance.now();
    const r = scanSource({ fileName: "bench.js", text, rules });
    runs.push(performance.now() - t);
    if (i === 0) console.log(`${lines}줄: 검출 ${r.summary.total}건`);
  }
  const worst = Math.max(...runs);
  const pass = worst <= goals[lines];
  if (!pass) ok = false;
  console.log(`  규칙 ${rules.length}건, 5회 중 최대 ${worst.toFixed(1)}ms / 목표 ${goals[lines]}ms → ${pass ? "통과" : "초과"}`);
}
process.exit(ok ? 0 : 1);
