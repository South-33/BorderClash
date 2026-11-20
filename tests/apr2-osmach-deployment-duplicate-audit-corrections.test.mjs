import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJsonl(path) {
  return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
}

const deploymentId = "ks7da4wpv0d73m0ehenasdtsnd843p3k";
const duplicateDeploymentIds = [
  "ks7de91nze78cwtbrq05kmv5ws844xyb",
  "ks71rymj25hfaj2nmdzazx67ts84436x",
  "ks7cdsxt8r5w8frbaz9ae0swf1847k30",
  "ks7dmcng54a3gzw26y1a4d4rbs846dq0",
  "ks7fnccjv0rbntn6ph1rzej939845c1t",
  "ks71xmh8r2mnr73kqa2g4rk6j984h2ra",
];
const protestId = "ks7753mv5v4v3q83daafq39vyn846p7x";
const duplicateProtestId = "ks70ccas8kh88sq73my5wct1qx847w0x";

test("Apr 2 O'Smach-Chong Chom M113 deployment keeps one stable survivor", () => {
  const timeline = readJsonl("data/timeline/2026-04.jsonl");
  const event = timeline.find((row) => row.id === deploymentId);
  assert.ok(event);
  for (const id of duplicateDeploymentIds) assert.equal(timeline.some((row) => row.id === id), false, id);
  assert.equal(event.date, "2026-04-02");
  assert.equal(event.timeOfDay, "");
  assert.match(event.title, /Two M113s/u);
  assert.match(event.description, /two M113 armored personnel carriers/u);
  assert.match(event.description, /about 06:20 on April 2/u);
  assert.match(event.description, /around 70 personnel/u);
  assert.match(event.description, /rejected the provocation allegation/u);
  assert.deepEqual(event.evidenceIds, ["js74ezbf7gysryynh6waqmw7fs845mjz", "jn710a1dt5qjyvn38etjtrb0y9844cm9"]);
});

test("Apr 2 deployment localizations preserve competing attribution and numbers", () => {
  const event = readJsonl("data/timeline/2026-04.jsonl").find((row) => row.id === deploymentId);
  assert.ok(event);
  assert.match(event.titleTh + event.descriptionTh, /[\u0E00-\u0E7F]/u);
  assert.match(event.titleKh + event.descriptionKh, /[\u1780-\u17FF]/u);
  for (const text of [event.descriptionTh, event.descriptionKh]) {
    assert.match(text, /M113/u);
    assert.match(text, /2/u);
    assert.match(text, /06:20/u);
    assert.match(text, /70/u);
    assert.doesNotMatch(text, /\?|�/u);
  }
});

test("Apr 3 Cambodian MFA protest remains a distinct multi-site diplomatic milestone", () => {
  const march = readJsonl("data/timeline/2026-03.jsonl");
  const april = readJsonl("data/timeline/2026-04.jsonl");
  const event = april.find((row) => row.id === protestId);
  assert.ok(event);
  assert.equal(march.some((row) => row.id === duplicateProtestId), false);
  assert.equal(april.some((row) => row.id === duplicateProtestId), false);
  assert.equal(event.category, "diplomatic");
  assert.equal(event.date, "2026-04-03");
  assert.equal(event.timeOfDay, "");
  assert.match(event.description, /March 31 to April 2/u);
  assert.match(event.description, /Boundary Pillars 45 and 47/u);
  assert.match(event.description, /Boundary Pillar No\. 2 in Anlong Veng/u);
  assert.match(event.description, /Cambodian government allegations/u);
});

test("Cambodian MOD and MFA reproductions use separate shared provenance chains", () => {
  const news = readJsonl("data/news/2026-04.jsonl");
  const byId = (id) => news.find((row) => row.id === id);
  assert.equal(byId("jn710a1dt5qjyvn38etjtrb0y9844cm9").provenanceId, "cambodia-mod-osmach-statement-2026-04-02");
  assert.equal(byId("jn7cm5cced9teccpbg7e6mvrbs8472tk").provenanceId, "cambodia-mod-osmach-statement-2026-04-02");
  assert.equal(byId("jn7ftqayxmp7rsyd9yw6fqhp0s846zy4").provenanceId, "cambodia-mfa-border-protest-2026-04-03");
  assert.equal(byId("jn78n001hvte4dmwbjr9d4re8x846ged").provenanceId, "cambodia-mfa-border-protest-2026-04-03");
  assert.match(byId("jn7ftqayxmp7rsyd9yw6fqhp0s846zy4").summary, /formal protest on April 3/u);
});
