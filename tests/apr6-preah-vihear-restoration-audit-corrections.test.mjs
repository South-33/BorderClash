import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJsonl(path) {
  return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
}

const eventId = "ks71rb3168cgf9cbrj6ttx8r4184mq20";
const evidenceId = "jn7favgvm7g28sexq8hawb4dn184nkcr";

test("Preah Vihear restoration assessment is dated to the April 6 media forum", () => {
  const event = readJsonl("data/timeline/2026-04.jsonl").find((row) => row.id === eventId);
  assert.ok(event);
  assert.equal(event.date, "2026-04-06");
  assert.equal(event.timeOfDay ?? "", "");
  assert.match(event.title, /20–30 Years/u);
  assert.match(event.description, /April 6 media forum/u);
  assert.match(event.description, /5–10 years/u);
  assert.match(event.description, /20–30 years/u);
  assert.doesNotMatch(event.description, /09:00/u);
});

test("the 562-point assessment keeps the July and December damage counts", () => {
  const event = readJsonl("data/timeline/2026-04.jsonl").find((row) => row.id === eventId);
  assert.ok(event);
  assert.match(event.description, /562 damage points/u);
  assert.match(event.description, /142 from the July 2025 fighting/u);
  assert.match(event.description, /420 from the December 2025 fighting/u);
});

test("all language versions keep Cambodian responsibility claims attributed", () => {
  const event = readJsonl("data/timeline/2026-04.jsonl").find((row) => row.id === eventId);
  assert.ok(event);
  assert.match(event.description, /Cambodian authorities attribute/u);
  assert.match(event.descriptionTh, /ทางการกัมพูชาระบุ/u);
  assert.match(event.descriptionKh, /អាជ្ញាធរកម្ពុជា/u);
  assert.match(event.descriptionTh, /20–30 ปี/u);
  assert.match(event.descriptionKh, /20–30 ឆ្នាំ/u);
});

test("evidence summary distinguishes the April 8 article from the April 6 event", () => {
  const article = readJsonl("data/news/2026-04.jsonl").find((row) => row.id === evidenceId);
  assert.ok(article);
  assert.match(article.summary, /published April 8/u);
  assert.match(article.summary, /April 6 media forum/u);
  assert.match(article.summary, /20–30 years/u);
});
