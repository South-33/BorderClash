import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJsonl(path) {
  return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
}

test("March 31 Thammanoon transfer is one event and does not invent a punitive cause", () => {
  const timeline = readJsonl("data/timeline/2026-03.jsonl");
  const event = timeline.find((row) => row.id === "ks7fwn01f9fzyfrcwg0mc2snsd83y9xq");
  const news = readJsonl("data/news/2026-03.jsonl");

  assert.ok(event);
  assert.equal(event.date, "2026-03-31");
  assert.equal(event.timeOfDay, undefined);
  assert.match(event.title, /17-Officer Rotation/u);
  assert.match(event.description, /routine midyear personnel rotation/u);
  assert.match(event.description, /no official statement established that incident as the cause/u);
  assert.deepEqual(event.evidenceIds, [
    "cc1e450cb49d09c0dde49b179bfb4ada",
    "d92301dae6928831a56bf83eeb7eac92",
    "jn7f9kcssxf1nt0pa2kf2es3f183zkpj",
  ]);
  assert.equal(timeline.some((row) => row.id === "ks75aayr9p612kqy4rm71za4vh83zs3s"), false);
  assert.match(news.find((row) => row.id === "cc1e450cb49d09c0dde49b179bfb4ada")?.summary || "", /does not establish/u);
  assert.match(news.find((row) => row.id === "d92301dae6928831a56bf83eeb7eac92")?.summary || "", /routine April midyear personnel rotation/u);
});
