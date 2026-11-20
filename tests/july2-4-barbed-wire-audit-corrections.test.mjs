import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJsonl(path) {
  return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
}

test("July barbed-wire chronology separates the July 2 allegation from the July 4 protest", () => {
  const timeline = readJsonl("data/timeline/2026-07.jsonl");
  const install = timeline.find((row) => row.id === "ks78m1fz93j97brkfrsxxbx9ad89w8s0");
  const protest = timeline.find((row) => row.id === "ks73mmhf0z8f16v2jd6yzg2g9h89x154");
  const news = readJsonl("data/news/2026-07.jsonl");
  const primary = news.find((row) => row.id === "jn7dk31yrk73drjjf8aafppnks8c054a");
  const kiripost = news.find((row) => row.id === "jn7f68vd716jm7kefc7nqbq2mx89xaxb");

  assert.ok(install);
  assert.ok(protest);
  assert.ok(primary);
  assert.ok(kiripost);
  assert.equal(install.date, "2026-07-02");
  assert.equal(install.timeOfDay, undefined);
  assert.match(install.title, /Cambodia Says/u);
  assert.match(install.description, /remain Cambodia's account/u);
  assert.deepEqual(install.evidenceIds, [primary.id]);
  assert.equal(protest.date, "2026-07-04");
  assert.equal(protest.timeOfDay, undefined);
  assert.match(protest.description, /On July 4/u);
  assert.match(protest.description, /not independent proof/u);
  assert.deepEqual(protest.evidenceIds, [primary.id, kiripost.id]);
  assert.equal(primary.provenanceId, "cambodia-mfa-july4-barbed-wire-protest");
  assert.equal(kiripost.provenanceId, primary.provenanceId);
});
