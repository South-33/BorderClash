import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const dec = readFileSync("data/timeline/2025-12.jsonl", "utf8").trim().split(/\r?\n/u).map(JSON.parse);
const jan = readFileSync("data/timeline/2026-01.jsonl", "utf8").trim().split(/\r?\n/u).map(JSON.parse);

test("Dec 17 public-figure appeals use dates stated in captured publisher text", () => {
  const event = dec.find((item) => item.id === "ks74mw3t9hqq016q6zbsjetexd8138nx");
  assert.equal(event.date, "2025-12-17");
  assert.equal(event.timeOfDay, undefined);
  assert.match(event.description, /Sombat Boonngam-anong/u);
  assert.match(event.description, /December 16/u);
  assert.doesNotMatch(event.description, /immediate ceasefire/u);
});

test("Dec 22 elephant deaths remain explicitly attributed", () => {
  const event = dec.find((item) => item.id === "ks79n68qn9zscw3636f1kbpq9d813k15");
  assert.equal(event.date, "2025-12-22");
  assert.equal(event.timeOfDay, undefined);
  assert.deepEqual(event.evidenceIds, ["js79my5prvxnhfbzdfbr7aj5ks7xz0eh"]);
  assert.match(event.description, /Cambodian claim/u);
  assert.match(event.description, /not independently established/u);
});

test("Jan 3 Preah Vihear video row preserves Thai attribution and drops unsupported time", () => {
  const event = jan.find((item) => item.id === "ks7b65pdyhm0ty7y9tz3fc59558131wq");
  assert.equal(event.date, "2026-01-03");
  assert.equal(event.timeOfDay, undefined);
  assert.match(event.description, /Thai Second Army Region's claim/u);
  assert.match(event.description, /anti-tank rockets/u);
});
