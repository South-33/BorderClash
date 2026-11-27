import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const [operation, targetPath, value] = process.argv.slice(2);

if (!targetPath) {
  throw new Error("usage: mutate-fixture.mjs <append-summary|bump-updated-at> <summary.json> [value]");
}

const path = resolve(targetPath);
const summary = JSON.parse(await readFile(path, "utf8"));

if (operation === "append-summary") {
  if (value == null) throw new Error("append-summary requires a suffix");
  summary.summary = String(summary.summary || "") + value;
} else if (operation === "bump-updated-at") {
  const delta = Number(value || 1);
  if (!Number.isFinite(delta) || delta <= 0) throw new Error("bump-updated-at requires a positive numeric delta");
  summary.updatedAt = Number(summary.updatedAt || 0) + delta;
} else {
  throw new Error("unknown fixture mutation: " + operation);
}

await writeFile(path, JSON.stringify(summary, null, 2) + "\n", "utf8");
