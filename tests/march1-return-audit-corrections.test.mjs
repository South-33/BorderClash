import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJsonl(path) {
  return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
}

test("March 1 displacement update uses the source-backed 06:00 cutoff and Cambodian provinces", () => {
  const event = readJsonl("data/timeline/2026-03.jsonl")
    .find((row) => row.id === "ks73c7fn1vpd0ej7pycmgvt4n5823s6a");
  const article = readJsonl("data/news/2026-03.jsonl")
    .find((row) => row.id === "jn76bek8xzh0ww8jagj8k6xd95823krr");

  assert.ok(event);
  assert.ok(article);
  assert.equal(event.date, "2026-03-01");
  assert.equal(event.timeOfDay, "06:00");
  assert.match(event.title, /92%/u);
  assert.match(event.description, /49,352/u);
  assert.match(event.description, /more than 640,000/u);
  assert.match(event.description, /06:00 on February 28 to 06:00 on March 1/u);
  assert.match(event.descriptionTh, /อุดรมีชัย/u);
  assert.match(event.descriptionTh, /บันทายมีชัย/u);
  assert.match(event.descriptionTh, /พระวิหาร/u);
  assert.doesNotMatch(event.descriptionTh, /ศรีสะเกษ/u);
  assert.match(article.summary, /06:00 on February 28 to 06:00 on March 1/u);
  assert.match(article.summary, /49,352/u);
  assert.match(article.summary, /Oddar Meanchey, Banteay Meanchey and Preah Vihear/u);
});
