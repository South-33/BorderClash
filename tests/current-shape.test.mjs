import assert from "node:assert/strict";
import test from "node:test";
import { currentSummaryPublic, keyUpdateRecords } from "../research/lib/current-shape.mjs";

const legacy = {
  updatedAt: 1,
  summary: "Border talks continue.",
  summaryTh: "การเจรจาชายแดนยังดำเนินต่อไป",
  summaryKh: "ការចរចាព្រំដែននៅតែបន្ត",
  keyUpdates: ["Talks resumed on 13 November 2026."],
  keyUpdatesTh: ["การเจรจากลับมาเริ่มอีกครั้งเมื่อ 13 พฤศจิกายน 2026"],
  keyUpdatesKh: ["ការចរចាបានចាប់ផ្តើមឡើងវិញនៅថ្ងៃទី 13 ខែវិច្ឆិកា ឆ្នាំ 2026"],
};

const structured = {
  updatedAt: legacy.updatedAt,
  summary: legacy.summary,
  summaryTh: legacy.summaryTh,
  summaryKh: legacy.summaryKh,
  summaryEvidenceIds: ["article-summary"],
  keyUpdates: [{
    text: legacy.keyUpdates[0],
    textTh: legacy.keyUpdatesTh[0],
    textKh: legacy.keyUpdatesKh[0],
    evidenceIds: ["article-update", "timeline-update"],
  }],
};

test("structured key updates export the exact existing UI contract", () => {
  assert.deepEqual(currentSummaryPublic(structured), currentSummaryPublic(legacy));
});

test("structured key updates keep translations and evidence together internally", () => {
  const [record] = keyUpdateRecords(structured);
  assert.equal(record.legacy, false);
  assert.deepEqual(record.evidenceIds, ["article-update", "timeline-update"]);
  assert.equal(record.textTh, legacy.keyUpdatesTh[0]);
  assert.equal(record.textKh, legacy.keyUpdatesKh[0]);
});

test("legacy parallel key-update arrays remain readable until audited migration", () => {
  const [record] = keyUpdateRecords(legacy);
  assert.equal(record.legacy, true);
  assert.equal(record.evidenceIds, null);
});

test("mixed string/object key updates are rejected instead of exported ambiguously", () => {
  assert.throws(
    () => keyUpdateRecords({ ...legacy, keyUpdates: [legacy.keyUpdates[0], structured.keyUpdates[0]] }),
    /all strings or all structured records/u,
  );
});
