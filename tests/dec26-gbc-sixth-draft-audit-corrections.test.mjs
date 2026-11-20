import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const rows = readFileSync("data/timeline/2025-12.jsonl", "utf8")
  .trim()
  .split(/\r?\n/u)
  .filter(Boolean)
  .map(JSON.parse);

test("Dec 26 GBC draft-consensus milestone keeps the supported time without overstating a final ceasefire", () => {
  const event = rows.find((row) => row.id === "ks7ddwpv8ad0bszpr99y4qat31812x0t");
  assert.ok(event);
  assert.equal(event.date, "2025-12-26");
  assert.equal(event.timeOfDay, "22:50");
  assert.match(event.title, /Reach Consensus on Draft Joint Statement/u);
  assert.match(event.description, /reached consensus at 22:50/u);
  assert.match(event.description, /sixth revised draft/u);
  assert.match(event.description, /National Security Council consideration/u);
  assert.match(event.description, /not yet the signed ceasefire/u);
  assert.deepEqual(event.evidenceIds, [
    "js75asdrn0hwammb2xg61p9ch57y2p2y",
    "jn75ar09s0gk1fwbjg0a4stcf57y35nw",
    "02f25386436faaa3ee49b18c6dbe9f6b",
  ]);
});
