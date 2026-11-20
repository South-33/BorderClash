import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
function readJsonl(path) { return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse); }
const eventId = "ks7db354hhf9hr0tm1wphvmfhh812p3j";
const primaryId = "1d6fd3117487622b594f6fc0955c27e9";
const khaosodId = "jne397f6de1db0507caace1d35158173";

test("Dec 13 Poipet milestone uses the captured 15:00 Thai MFA briefing", () => {
  const event = readJsonl("data/timeline/2025-12.jsonl").find((row) => row.id === eventId);
  assert.ok(event);
  assert.equal(event.date, "2025-12-13");
  assert.equal(event.timeOfDay, "15:00");
  assert.deepEqual(event.evidenceIds, [primaryId]);
  assert.match(event.title, /Planned Poipet Border Reopening Was Postponed/u);
  assert.match(event.description, /6,000-7,000 Thai nationals/u);
  assert.match(event.description, /postponed indefinitely/u);
});

test("primary MFA record is high-confidence official evidence while uncaptured Khaosod stays secondary", () => {
  const articles = readJsonl("data/news/2025-12.jsonl");
  const primary = articles.find((row) => row.id === primaryId);
  const khaosod = articles.find((row) => row.id === khaosodId);
  assert.equal(primary?.source, "Ministry of Foreign Affairs of Thailand");
  assert.equal(primary?.credibility, 100);
  assert.equal(primary?.provenanceId, "thai-mfa-press-briefing-2025-12-13");
  assert.match(primary?.summary || "", /press briefing at 15:00/u);
  assert.match(khaosod?.summary || "", /publisher page is not currently captured/u);
  assert.notEqual(khaosod?.provenanceId, primary?.provenanceId);
});