import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJsonl(path) {
  return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
}

test("Jan 1 HRF snapshot attributes casualty figures to Cambodian authorities", () => {
  const timeline = readJsonl("data/timeline/2026-01.jsonl");
  const news = readJsonl("data/news/2026-01.jsonl");
  const event = timeline.find((row) => row.id === "ks7c5gvvpw28qv1zs90wt1thnd8136bj");
  const unPage = news.find((row) => row.id === "k971bytk9dj5frqryf7br07res7zjqpm");
  const reliefWeb = news.find((row) => row.id === "k9796xzj4gq4znkw04a4rkhgad7yjgd2");

  assert.ok(event);
  assert.ok(unPage);
  assert.ok(reliefWeb);
  assert.equal(event.date, "2026-01-01");
  assert.equal(event.timeOfDay, undefined);
  assert.equal(event.importance, 75);
  assert.match(event.title, /HRF Reports/u);
  assert.match(event.description, /Ministry of Interior reported 32 civilian deaths and 94 injuries/u);
  assert.match(event.description, /not independently verified UN casualty counts/u);
  assert.doesNotMatch(event.title, /UN Verifies/iu);
  assert.doesNotMatch(event.description, /UN confirms/iu);
  assert.equal(unPage.source, "United Nations in Cambodia / HRF");
  assert.match(unPage.summary, /does not independently verify/iu);
  assert.match(reliefWeb.summary, /rather than independently verified/iu);
  assert.equal(unPage.provenanceId, "hrf-sitrep13-2026-01-02");
  assert.equal(reliefWeb.provenanceId, unPage.provenanceId);
});
