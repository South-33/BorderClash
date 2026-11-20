import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJsonl(path) {
  return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
}

test("Kiet Simak return is Jan 20 and later unrelated reports do not create duplicate return events", () => {
  const janTimeline = readJsonl("data/timeline/2026-01.jsonl");
  const febTimeline = readJsonl("data/timeline/2026-02.jsonl");
  const janNews = readJsonl("data/news/2026-01.jsonl");
  const febNews = readJsonl("data/news/2026-02.jsonl");
  const event = janTimeline.find((row) => row.id === "ks73k2bbtektjdty0ak001xqq5812mbj");
  const janArticle = janNews.find((row) => row.id === "jn7bgpfnrp9acby299mqk6ze997zt8n5");
  const mineArticle = febNews.find((row) => row.id === "jn795zs3j5mw00qffqmmj4kyx580zjb0");
  const feb13Article = febNews.find((row) => row.id === "jn77pj2j4vfh9vkavrm4qza6nn8122yv");

  assert.ok(event);
  assert.equal(event.date, "2026-01-20");
  assert.equal(event.timeOfDay, undefined);
  assert.match(event.description, /returned to Cambodia/u);
  assert.match(event.description, /December 24, 2025/u);
  assert.equal(febTimeline.some((row) => row.id === "ks7d8k0zs8jgxa4ymhvmwf3j9s812d1a"), false);
  assert.equal(febTimeline.some((row) => row.id === "ks7fcw2y4z7ta2sv5efbfmzk7n812xfc"), false);
  assert.match(janArticle.summary, /afternoon of January 20/u);
  assert.doesNotMatch(mineArticle.summary, /officer|repatriat/iu);
  assert.match(mineArticle.title, /Mine Authority/u);
  assert.match(feb13Article.summary, /did not describe a police-officer repatriation/u);
});

test("Boeung Trakuon and Chouk Chey protest is anchored to Feb 11 without a duplicate Feb 12 milestone", () => {
  const timeline = readJsonl("data/timeline/2026-02.jsonl");
  const news = readJsonl("data/news/2026-02.jsonl");
  const event = timeline.find((row) => row.id === "ks77t4asw52wkvkt0dwad2xrb1812hvd");
  const provenance = "cambodia-mfa-feb11-banteay-meanchey-protest";

  assert.ok(event);
  assert.equal(event.date, "2026-02-11");
  assert.equal(event.timeOfDay, undefined);
  assert.equal(event.category, "diplomatic");
  assert.match(event.title, /Cambodia Protests/u);
  assert.match(event.description, /local authorities reported/u);
  assert.match(event.description, /remain attributed to Cambodian authorities/u);
  assert.equal(timeline.some((row) => row.id === "ks783ba9ctc6sckzv2e30k8k25814xde"), false);
  for (const id of [
    "jn717nedaywv9ssprapfymd5rs8100hh",
    "jn71ezwd0n8mvv64eg7wze456x81304w",
    "jn7anerncw0gaph7s8pmfq0fm5812xgn",
  ]) {
    assert.equal(news.find((row) => row.id === id)?.provenanceId, provenance);
  }
});
