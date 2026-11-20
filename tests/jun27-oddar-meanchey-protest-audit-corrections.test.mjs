import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJsonl(path) {
  return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
}

const eventId = "ks71rdqq77gbwfmh1ja45n97d989j37y";
const evidenceId = "e0fc866092f9988d58ab2349d896e109";

test("Cambodian protest is dated to the June 27 MFAIC release and has no invented exact time", () => {
  const event = readJsonl("data/timeline/2026-06.jsonl").find((row) => row.id === eventId);
  assert.ok(event);
  assert.equal(event.date, "2026-06-27");
  assert.equal(event.timeOfDay, undefined);
  assert.equal(event.category, "diplomatic");
  assert.deepEqual(event.evidenceIds, [evidenceId]);
});

test("territorial and legal claims stay attributed to Cambodia", () => {
  const event = readJsonl("data/timeline/2026-06.jsonl").find((row) => row.id === eventId);
  assert.match(event.description, /alleging that Thai armed forces/u);
  assert.match(event.description, /Cambodia said/u);
  assert.match(event.description, /Cambodia's position/u);
  assert.match(event.description, /does not independently establish/u);
  assert.match(event.description, /Boundary Pillar No\. 26/u);
  assert.match(event.description, /2000 land-boundary MOU/u);
});

test("Thai and Khmer copies preserve dates, location and attribution boundary", () => {
  const event = readJsonl("data/timeline/2026-06.jsonl").find((row) => row.id === eventId);
  for (const value of ["27", "23", "26", "2000"]) {
    assert.ok(event.descriptionTh.includes(value), "Thai " + value);
    assert.ok(event.descriptionKh.includes(value), "Khmer " + value);
  }
  assert.match(event.descriptionTh, /เป็นจุดยืนของกัมพูชา/u);
  assert.match(event.descriptionKh, /ជាជំហររបស់កម្ពុជា/u);
});

test("AKP row records the Cambodian government source rather than independent corroboration", () => {
  const article = readJsonl("data/news/2026-06.jsonl").find((row) => row.id === evidenceId);
  assert.ok(article);
  assert.equal(article.source, "AKP");
  assert.equal(article.credibility, 60);
  assert.match(article.summary, /formal protest on June 27/u);
  assert.match(article.summary, /Cambodia's stated position/u);
});
