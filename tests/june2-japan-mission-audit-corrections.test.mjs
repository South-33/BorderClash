import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJsonl(path) {
  return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
}

const eventId = "ks73x2yjfta8b48dsk5pjwd2ts880xds";
const evidenceId = "k974pa8as8yjwr2zydeb38qnd5880akf";

test("Japan mission is date-only and uses the supported May 31-June 2 itinerary", () => {
  const event = readJsonl("data/timeline/2026-06.jsonl").find((row) => row.id === eventId);
  assert.ok(event);
  assert.equal(event.date, "2026-06-02");
  assert.equal(event.timeOfDay ?? "", "");
  assert.match(event.description, /May 31–June 2 mission/u);
  assert.match(event.description, /Cambodian officials on June 1/u);
  assert.match(event.description, /Thai officials on June 2/u);
  assert.doesNotMatch(event.description, /17:00/u);
});

test("all language versions preserve Japan's ceasefire and de-escalation message", () => {
  const event = readJsonl("data/timeline/2026-06.jsonl").find((row) => row.id === eventId);
  assert.ok(event);
  assert.match(event.description, /ceasefire agreement/u);
  assert.match(event.description, /maximum restraint/u);
  assert.match(event.descriptionTh, /ข้อตกลงหยุดยิง/u);
  assert.match(event.descriptionTh, /ความอดกลั้นสูงสุด/u);
  assert.match(event.descriptionKh, /កិច្ចព្រមព្រៀងឈប់បាញ់/u);
  assert.match(event.descriptionKh, /អត់ធ្មត់ជាអតិបរមា/u);
});

test("Japan MFA evidence summary distinguishes the two consultation dates", () => {
  const article = readJsonl("data/news/2026-06.jsonl").find((row) => row.id === evidenceId);
  assert.ok(article);
  assert.match(article.summary, /May 31 to June 2/u);
  assert.match(article.summary, /Cambodian officials on June 1/u);
  assert.match(article.summary, /Thai officials on June 2/u);
});
