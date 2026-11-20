import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJsonl(path) {
  return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
}

const survivorId = "ks73hxvfv4metz1j717nnhvzzs865zf3";
const delayId = "ks7bgm31b5akkhe4mqzg6mth2s85vmx7";
const mayWrapperId = "ks72c4zpeybk9305y9te4wn7nh863b0y";
const capturedThairathId = "d0ef030dc5c708d46247d88b3c79b08d";
const thaigerId = "js7dqq4qqw8f6v11s784v7hhrd863anz";
const handoverProvenance = "thai-cambodia-apr30-635-repatriation";

test("April 30 handover wrappers collapse into one event", () => {
  const april = readJsonl("data/timeline/2026-04.jsonl");
  const may = readJsonl("data/timeline/2026-05.jsonl");
  const event = april.find((row) => row.id === survivorId);
  assert.ok(event);
  assert.equal(event.date, "2026-04-30");
  assert.equal(event.timeOfDay, "16:50");
  assert.equal(april.some((row) => row.id === delayId), false);
  assert.equal(may.some((row) => row.id === mayWrapperId), false);
});

test("the event records both batches and same-day completion", () => {
  const event = readJsonl("data/timeline/2026-04.jsonl").find((row) => row.id === survivorId);
  assert.ok(event);
  assert.match(event.description, /first 350/u);
  assert.match(event.description, /16:50/u);
  assert.match(event.description, /further 285/u);
  assert.match(event.description, /18:20/u);
  assert.match(event.description, /completing the agreed handover of 635 people that day/u);
  assert.deepEqual(event.evidenceIds, [capturedThairathId, thaigerId]);
});

test("screening language does not classify all returnees as offenders", () => {
  const event = readJsonl("data/timeline/2026-04.jsonl").find((row) => row.id === survivorId);
  assert.ok(event);
  assert.match(event.description, /may have been trafficked or deceived into work/u);
  assert.match(event.description, /suspected of knowingly participating/u);
  assert.match(event.descriptionTh, /อาจถูกหลอกหรือค้ามนุษย์/u);
  assert.match(event.descriptionKh, /អាចត្រូវបានជួញដូរ ឬបោកបញ្ឆោត/u);
});

test("captured handover reports share one provenance chain", () => {
  const aprilNews = readJsonl("data/news/2026-04.jsonl");
  const mayNews = readJsonl("data/news/2026-05.jsonl");
  const englishThairath = aprilNews.find((row) => row.id === capturedThairathId);
  const thaiger = mayNews.find((row) => row.id === thaigerId);
  assert.ok(englishThairath);
  assert.ok(thaiger);
  assert.equal(englishThairath.provenanceId, handoverProvenance);
  assert.equal(thaiger.provenanceId, handoverProvenance);
});
