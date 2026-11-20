import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJsonl(path) {
  return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
}

test("restoration task-force approval is anchored to Hun Manet's Dec 23 signature", () => {
  const decTimeline = readJsonl("data/timeline/2025-12.jsonl");
  const janTimeline = readJsonl("data/timeline/2026-01.jsonl");
  const janNews = readJsonl("data/news/2026-01.jsonl");
  const event = decTimeline.find((row) => row.id === "ks73f8c5b3rfkaxnax0a30pvnx8133yq");
  const article = janNews.find((row) => row.id === "jn734ghtmdmarj3pygj8jfehhd7ycxdz");

  assert.ok(event);
  assert.ok(article);
  assert.equal(event.date, "2025-12-23");
  assert.equal(event.timeOfDay, undefined);
  assert.equal(event.category, "humanitarian");
  assert.match(event.title, /Signs Approval/u);
  assert.match(event.description, /signed the decision approving/u);
  assert.match(event.description, /25-member group/u);
  assert.deepEqual(event.evidenceIds, ["jn734ghtmdmarj3pygj8jfehhd7ycxdz"]);
  assert.equal(janTimeline.some((row) => row.id === event.id), false);
  assert.match(article.summary, /signed on December 23/u);
  assert.equal(janNews.some((row) => row.id === "jn74vr1922qjkg3bkmss840ng17z75tt"), false);

  const allTimeline = [
    ...decTimeline,
    ...janTimeline,
  ];
  assert.equal(allTimeline.some((row) => row.evidenceIds?.includes("jn74vr1922qjkg3bkmss840ng17z75tt")), false);
});
