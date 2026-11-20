import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJsonl(path) {
  return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
}

const eventId = "ks75fb62z06kps35achg88m6rn8244rm";
const articleId = "jn769s8hpmzmj7wwhqqrpb4sdh825qxm";

test("diplomatic site visit uses the source-supported Feb 23 event date and no invented time", () => {
  const event = readJsonl("data/timeline/2026-02.jsonl").find((row) => row.id === eventId);
  assert.ok(event);
  assert.equal(event.date, "2026-02-23");
  assert.equal(event.timeOfDay ?? "", "");
  assert.equal(event.category, "diplomatic");
  assert.match(event.title, /Diplomatic Visit to Banteay Meanchey Border Sites/u);
  assert.doesNotMatch(event.description, /10:00/u);
});

test("record keeps Cambodian territorial claims attributed and preserves the displacement figure", () => {
  const event = readJsonl("data/timeline/2026-02.jsonl").find((row) => row.id === eventId);
  assert.ok(event);
  assert.match(event.description, /citing a Cambodian Foreign Ministry press release/u);
  assert.match(event.description, /Cambodian officials described the sites as areas occupied by Thai forces/u);
  assert.match(event.description, /nearly 10,000 displaced people/u);
  assert.match(event.description, /claims are Cambodia's account/u);
});

test("English Thai and Khmer preserve the event date and nearly 10,000 figure", () => {
  const event = readJsonl("data/timeline/2026-02.jsonl").find((row) => row.id === eventId);
  assert.ok(event);
  for (const field of ["description", "descriptionTh", "descriptionKh"]) {
    assert.match(event[field], /23/u);
    assert.match(event[field], /10,000/u);
    assert.match(event[field], /AKP/u);
  }
  assert.match(event.descriptionTh, /คำกล่าวของฝ่ายกัมพูชา/u);
  assert.match(event.descriptionKh, /ការរៀបរាប់របស់ភាគីកម្ពុជា/u);
});

test("AKP evidence summary records the Feb 23 source date and MFA provenance", () => {
  const article = readJsonl("data/news/2026-02.jsonl").find((row) => row.id === articleId);
  assert.ok(article);
  assert.equal(article.category, "diplomatic");
  assert.equal(article.provenanceId, "cambodia-mfa-feb23-banteay-meanchey-diplomatic-visit");
  assert.match(article.summary, /February 23 site visit/u);
  assert.match(article.summary, /claims are Cambodia's account/u);
  assert.match(article.summary, /nearly 10,000 displaced people/u);
});
