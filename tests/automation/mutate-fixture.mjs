import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const [operation, targetPath, value] = process.argv.slice(2);

if (operation !== "append-summary" || !targetPath || value == null) {
  throw new Error("usage: mutate-fixture.mjs append-summary <summary.json> <suffix>");
}

const path = resolve(targetPath);
const summary = JSON.parse(await readFile(path, "utf8"));
summary.summary = String(summary.summary || "") + value;
await writeFile(path, JSON.stringify(summary, null, 2) + "\n", "utf8");
