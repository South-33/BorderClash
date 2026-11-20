import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJsonl(path) {
  return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
}

const survivorId = "ks74y4cb1wnp2hcmb2kyh92d5x813crj";
const duplicateId = "ks70sfync3mka2mtffee84wjjd8130g7";
const dapId = "jn7csggr6k9gx354w7nrp8wx3s80wrap";
const khmerTimesId = "jn7axz81610z45yqnnqbdyrd1580t7th";
const provenanceId = "oddar-meanchey-osmach-dec28-barriers";

test("O'Smach barrier event keeps the stable survivor ID but moves to Dec 28", () => {
  const dec = readJsonl("data/timeline/2025-12.jsonl");
  const feb = readJsonl("data/timeline/2026-02.jsonl");
  const survivor = dec.find((row) => row.id === survivorId);
  assert.ok(survivor);
  assert.equal(survivor.date, "2025-12-28");
  assert.equal(survivor.timeOfDay, "");
  assert.equal(feb.find((row) => row.id === survivorId), undefined);
  assert.equal(feb.find((row) => row.id === duplicateId), undefined);
  assert.match(survivor.title, /Cambodian Official Says/u);
  assert.match(survivor.description, /morning of December 28/u);
  assert.match(survivor.description, /one day after the December 27 ceasefire/u);
  assert.match(survivor.description, /about 400 metres/u);
  assert.match(survivor.description, /exceeded 420 metres/u);
  assert.match(survivor.description, /Cambodian official claim/u);
  assert.deepEqual(survivor.evidenceIds, [dapId, khmerTimesId]);
});

test("Dec 28 O'Smach localizations preserve date, distances, attribution and uncertainty", () => {
  const row = readJsonl("data/timeline/2025-12.jsonl").find((item) => item.id === survivorId);
  assert.ok(row);
  assert.match(row.titleTh + row.descriptionTh, /[\u0E00-\u0E7F]/u);
  assert.match(row.titleKh + row.descriptionKh, /[\u1780-\u17FF]/u);
  for (const text of [row.descriptionTh, row.descriptionKh]) {
    assert.match(text, /28/u);
    assert.match(text, /27/u);
    assert.match(text, /400/u);
    assert.match(text, /420/u);
    assert.match(text, /15/u);
    assert.doesNotMatch(text, /\?|�/u);
  }
  assert.match(row.descriptionTh, /เจ้าหน้าที่กัมพูชา/u);
  assert.match(row.descriptionKh, /មន្ត្រីកម្ពុជា/u);
});

test("DAP and Khmer Times share the provincial-authority provenance chain", () => {
  const news = readJsonl("data/news/2026-02.jsonl");
  const dap = news.find((row) => row.id === dapId);
  const khmerTimes = news.find((row) => row.id === khmerTimesId);
  assert.ok(dap);
  assert.ok(khmerTimes);
  assert.equal(dap.provenanceId, provenanceId);
  assert.equal(khmerTimes.provenanceId, provenanceId);
  assert.match(dap.summary, /December 28, 2025/u);
  assert.match(khmerTimes.summary, /not independently established/u);
  assert.equal(khmerTimes.category, "military");
});
