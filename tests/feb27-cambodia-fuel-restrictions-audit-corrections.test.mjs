import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const id = "ks74r6c8r8ef67d3jrs1q4enyd82466x";
const row = () => readFileSync("data/timeline/2026-02.jsonl", "utf8")
  .trim().split(/\r?\n/u).map(JSON.parse).find((item) => item.id === id);
const article = () => readFileSync("data/news/2026-03.jsonl", "utf8")
  .trim().split(/\r?\n/u).map(JSON.parse).find((item) => item.id === "k9725hq2p4hdhr9pm1cjs2c81n824aej");

test("fuel restriction milestone follows the Feb 27 reported action", () => {
  const event = row();
  assert.equal(event.date, "2026-02-27");
  assert.equal(event.timeOfDay, undefined);
  assert.match(event.description, /Chong Mek/u);
  assert.match(event.description, /Second Army Region/u);
  assert.match(event.description, /after abnormal volumes/u);
  assert.match(event.description, /claims that some fuel had moved through Laos/u);
});

test("fuel source metadata follows the captured Asia Daily attribution", () => {
  const source = article();
  assert.equal(source.source, "The Laotian Times (via Asia Daily)");
  assert.match(source.summary, /Namfon Chanthavong of The Laotian Times/u);
});
