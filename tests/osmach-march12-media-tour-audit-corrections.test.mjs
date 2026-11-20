import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJsonl(path) {
  return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
}

test("O'Smach media-tour coverage stays one March 12 event with attributed claims", () => {
  const timeline = readJsonl("data/timeline/2026-03.jsonl");
  const event = timeline.find((row) => row.id === "ks79enzs3rrx394n3phpmg6zex82rt59");
  const news = readJsonl("data/news/2026-03.jsonl");
  const afp = news.find((row) => row.id === "k9772y9pm84n9xc9ja4kafdv4x82rw5d");

  assert.ok(event);
  assert.ok(afp);
  assert.equal(event.date, "2026-03-12");
  assert.equal(event.timeOfDay, undefined);
  assert.match(event.description, /organized a press trip/u);
  assert.match(event.description, /The Thai military said about 20,000/u);
  assert.match(event.description, /Cambodian Information Minister Neth Pheaktra/u);
  assert.match(event.description, /territorial dispute remains unresolved/u);
  assert.deepEqual(event.evidenceIds, [
    "k9772y9pm84n9xc9ja4kafdv4x82rw5d",
    "k9721pm1aaw86bgzget2bjqbfx830kfh",
    "js70x2s8b6gz208eavq9d7kp9182tmhc",
  ]);
  assert.equal(timeline.some((row) => row.id === "ks7008j551c9yykmrjqm55w3j9830gex"), false);
  assert.equal(timeline.some((row) => row.id === "ks768hhmkakqz3jq6qfhgkj2qh82ts0j"), false);
  assert.match(afp.summary, /On March 12/u);
  assert.match(afp.summary, /20,000 alleged scammers/u);
  assert.match(afp.summary, /de facto annexation/u);
});
