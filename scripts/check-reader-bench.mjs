import fs from "node:fs";

const file = process.argv[2];
if (!file) throw new Error("usage: node scripts/check-reader-bench.mjs <result.json>");

const result = JSON.parse(fs.readFileSync(file, "utf8").replace(/^\uFEFF/u, ""));
if (result.status !== "SUCCESS") throw new Error(`benchmark status=${result.status}`);

const response = String(result.response || "");
const issues = [];
if (response.includes("\uFFFD")) issues.push("replacement-character");

for (const line of response.split(/\r?\n/u)) {
  if (/^TH:/u.test(line) && /[\u1780-\u17FF]/u.test(line)) issues.push("thai-line-contains-khmer");
  if (/^KH:/u.test(line) && /[\u0E00-\u0E7F]/u.test(line)) issues.push("khmer-line-contains-thai");
}

const blocks = response.split(/(?=^\d+\.\s*$)/gmu);
const item = (number) => blocks.find((block) => new RegExp(`^${number}\\.`, "mu").test(block)) || "";

if (/crossed|encroached|intruded/iu.test(item(3))) issues.push("item-3-strengthened-moved-forward");
if (/unable to return|cannot return|can't return/iu.test(item(4))) issues.push("item-4-inferred-return-home");
if (/^EN:\s*(?:There is|There are|No)\s+(?:no\s+)?armed (?:fighting|clashes?)(?![^\n]*report)/imu.test(item(1))) {
  issues.push("item-1-lost-reported-caveat");
}

if (issues.length) {
  console.error(JSON.stringify({ ok: false, issues: [...new Set(issues)] }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({ ok: true }));
