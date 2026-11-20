import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJsonl(path) {
  return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
}

const eventId = "ks7cy06rbgmxq66n09p8qyz9ns81emga";
const vodId = "jn7572nw34z086mk9k6439s40d81e4pb";
const protestId = "ks77t4asw52wkvkt0dwad2xrb1812hvd";

test("border-earthworks row uses the Feb 17 commander-warning date and no invented exact time", () => {
  const event = readJsonl("data/timeline/2026-02.jsonl").find((row) => row.id === eventId);
  assert.ok(event);
  assert.equal(event.date, "2026-02-17");
  assert.equal(event.timeOfDay, "");
  assert.deepEqual(event.evidenceIds, [vodId]);
  assert.match(event.title, /Commander.*Border Works/u);
});

test("Feb 17 row separates the earlier Cambodian formal protest", () => {
  const rows = readJsonl("data/timeline/2026-02.jsonl");
  const event = rows.find((row) => row.id === eventId);
  const protest = rows.find((row) => row.id === protestId);
  assert.ok(event);
  assert.ok(protest);
  assert.equal(protest.date, "2026-02-11");
  assert.doesNotMatch(event.description, /February 11|formal protest/u);
  assert.doesNotMatch(event.description, /security and scam prevention/u);
});

test("event preserves the Feb 16 and Feb 17 chronology and competing boundary positions", () => {
  const event = readJsonl("data/timeline/2026-02.jsonl").find((row) => row.id === eventId);
  assert.ok(event);
  assert.match(event.description, /Chouk Chey on February 16/u);
  assert.match(event.description, /Jam Tae near Ta Mok on February 17/u);
  assert.match(event.description, /Thailand's 1:50,000 map/u);
  assert.match(event.description, /Cambodian sources disputed the boundary/u);
  assert.match(event.descriptionTh, /16 กุมภาพันธ์/u);
  assert.match(event.descriptionTh, /17 กุมภาพันธ์/u);
  assert.match(event.descriptionKh, /ថ្ងៃទី 16 ខែកុម្ភៈ/u);
  assert.match(event.descriptionKh, /ថ្ងៃទី 17 ខែកុម្ភៈ/u);
});

test("stored VOD summary no longer turns article publication into event chronology", () => {
  const article = readJsonl("data/news/2026-02.jsonl").find((row) => row.id === vodId);
  assert.ok(article);
  assert.equal(article.credibility, 40);
  assert.match(article.summary, /on February 17/u);
  assert.match(article.summary, /Chouk Chey on February 16/u);
  assert.match(article.summary, /Jam Tae near Ta Mok on February 17/u);
  assert.match(article.summary, /Cambodian sources disputed the boundary/u);
});
