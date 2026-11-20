import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) =>
  readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);

const eventId = "ks7bvrcszjym4q852emt8qrz99844egt";
const evidenceId = "a5657a55bdd74edd44445dbfbfda35e3";

test("Chong An Ma row uses the March 30 report date and no unsupported exact time", () => {
  const event = read("data/timeline/2026-03.jsonl").find((row) => row.id === eventId);
  assert.ok(event);
  assert.equal(event.date, "2026-03-30");
  assert.equal(event.timeOfDay, undefined);
  assert.equal(event.status, "unverified");
  assert.deepEqual(event.evidenceIds, [evidenceId]);
});

test("one-kilometre withdrawal remains a retrospective Thai military claim", () => {
  const event = read("data/timeline/2026-03.jsonl").find((row) => row.id === eventId);
  assert.match(event.title, /Thai Task Force Officer Says/u);
  assert.match(event.description, /Col Talad Poolsawat/u);
  assert.match(event.description, /retreated about one kilometre/u);
  assert.match(event.description, /December 17, 2025/u);
  assert.match(event.description, /Thai military account/u);
  assert.match(event.description, /does not independently establish the boundary/u);
  assert.match(event.description, /exact date of the reported Cambodian withdrawal/u);
  assert.doesNotMatch(event.description, /prior March 31|new de-escalation step|14:00/u);
});

test("Thai and Khmer copies preserve retrospective timing without audit meta-copy", () => {
  const event = read("data/timeline/2026-03.jsonl").find((row) => row.id === eventId);
  for (const value of [event.descriptionTh, event.descriptionKh]) {
    assert.ok(value.includes("17"));
    assert.ok(value.includes("2025"));
    assert.ok(!value.includes("14:00"));
    assert.ok(!value.includes("31"));
  }
});

test("captured Thai Rath article keeps territorial-control claims attributed", () => {
  const article = read("data/news/2026-03.jsonl").find((row) => row.id === evidenceId);
  assert.ok(article);
  assert.equal(article.source, "Thai Rath");
  assert.match(article.summary, /Thai military claims/u);
  assert.match(article.summary, /not independently established/u);
});
