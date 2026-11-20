import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const id = "ks70mbz7t40zxre22dyvxgnmx58153qt";
test("unsupported Feb 13 Preah Vihear bunker row is absent", () => {
  const rows = readFileSync("data/timeline/2026-02.jsonl", "utf8")
    .trim().split(String.fromCharCode(10)).map(JSON.parse);
  assert.equal(rows.some((row) => row.id === id), false);
});
