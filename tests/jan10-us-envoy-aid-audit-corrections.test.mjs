import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const id = "ks77917a9qmx7qpcvjhq62t9qs813sgx";
const row = () => readFileSync("data/timeline/2026-01.jsonl", "utf8")
  .trim().split(/\r?\n/u).map(JSON.parse).find((item) => item.id === id);

test("US envoy aid milestone is dated to the Jan 10 meeting and preserves amounts", () => {
  const event = row();
  assert.equal(event.date, "2026-01-10");
  assert.equal(event.timeOfDay, undefined);
  assert.match(event.description, /\$15 million/u);
  assert.match(event.description, /\$10 million for landmine/u);
  assert.match(event.description, /separately announced (?:another )?\$10 million/u);
  assert.match(event.description, /cybercrime/u);
});
