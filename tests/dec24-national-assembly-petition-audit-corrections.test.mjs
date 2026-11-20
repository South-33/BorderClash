import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJsonl(path) {
  return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
}

const eventId = "ks7dn072aszyaajj8s2kjeczjx813wqd";
const articleId = "jn78wp9134r6m1d21jwp1qc9vh7y1pxt";

test("December 24 Assembly petition appeals to the UN rather than being addressed to it", () => {
  const event = readJsonl("data/timeline/2025-12.jsonl").find((row) => row.id === eventId);
  assert.ok(event);
  assert.equal(event.date, "2025-12-24");
  assert.equal(event.timeOfDay ?? "", "");
  assert.match(event.title, /Appeals to UN and International Community/u);
  assert.match(event.description, /appealed to the international community, the United Nations and parliaments worldwide/u);
  assert.match(event.description, /was not itself a petition addressed to the UN/u);
  assert.deepEqual(event.evidenceIds, [articleId]);
});

test("18:00 is retained only as the Ministry of Interior casualty-data cutoff", () => {
  const event = readJsonl("data/timeline/2025-12.jsonl").find((row) => row.id === eventId);
  assert.ok(event);
  assert.match(event.description, /as of 18:00 that day/u);
  assert.match(event.description, /30 Cambodian civilians had been killed/u);
  assert.match(event.description, /87 injured/u);
  assert.match(event.description, /more than 630,000 displaced/u);
});

test("English, Thai and Khmer keep military and casualty claims attributed to Cambodian institutions", () => {
  const event = readJsonl("data/timeline/2025-12.jsonl").find((row) => row.id === eventId);
  assert.ok(event);
  for (const field of ["description", "descriptionTh", "descriptionKh"]) {
    assert.match(event[field], /30/u);
    assert.match(event[field], /87/u);
    assert.match(event[field], /630,000/u);
    assert.match(event[field], /18:00/u);
  }
  assert.match(event.description, /claims are attributed to Cambodian institutions/u);
  assert.match(event.descriptionTh, /สถาบันกัมพูชาเป็นผู้กล่าวอ้าง/u);
  assert.match(event.descriptionKh, /ការអះអាងរបស់ស្ថាប័នកម្ពុជា/u);
});

test("AKP evidence summary reflects the petition's actual appeal and attribution", () => {
  const article = readJsonl("data/news/2025-12.jsonl").find((row) => row.id === articleId);
  assert.ok(article);
  assert.equal(article.credibility, 70);
  assert.equal(article.provenanceId, "cambodia-national-assembly-dec24-petition");
  assert.match(article.summary, /appealed to the international community, the United Nations and parliaments worldwide/u);
  assert.match(article.summary, /military and casualty claims are attributed to Cambodian institutions/u);
});
