import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJsonl(path) {
  return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
}

test("Nov 11 OIF milestone is framed as the dated MFA announcement, not an assumed sending date", () => {
  const timeline = readJsonl("data/timeline/2026-11.jsonl");
  const event = timeline.find((row) => row.id === "ebcb7de2fcf2e181a459f81f83bc5bf1");

  assert.ok(event);
  assert.equal(event.date, "2026-11-11");
  assert.equal(event.timeOfDay, "14:15");
  assert.match(event.title, /Thailand Announces OIF Démarche/u);
  assert.match(event.description, /At its November 11 weekly press briefing/u);
  assert.match(event.description, /had sent a démarche/u);
  assert.match(event.description, /does not establish when the démarche itself was sent/u);
  assert.match(event.description, /does not.*prove that Cambodia misrepresented/iu);
});

test("Thai MFA source summary records the briefing date separately from the unknown sending date", () => {
  const news = readJsonl("data/news/2026-11.jsonl");
  const article = news.find((row) => row.id === "305c945747e78d32b00775c7b324664d");

  assert.ok(article);
  assert.match(article.summary, /14:15 weekly press briefing on November 11, 2026/u);
  assert.match(article.summary, /did not specify the date on which the démarche itself was sent/u);
});
