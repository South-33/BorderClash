import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const id = "ks70bjx4nn4bw017xfc8xvj8rx823ycs";
const row = () => readFileSync("data/timeline/2026-02.jsonl", "utf8")
  .trim().split(/\r?\n/u).map(JSON.parse).find((item) => item.id === id);

test("Feb 26 CMAA record stays within captured publisher claim", () => {
  const event = row();
  assert.equal(event.date, "2026-02-26");
  assert.equal(event.timeOfDay, undefined);
  assert.deepEqual(event.evidenceIds, ["jn7cbkr39ybqakgp7q0dh5yjh9822wg5"]);
  assert.match(event.description, /Cambodian Mine Action Authority \(CMAA\)/u);
  assert.match(event.description, /called on Thailand to present specific evidence/u);
  assert.doesNotMatch(event.description, /planting new landmines|delay joint border survey|maintain military positions/u);
});
