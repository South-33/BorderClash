import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const targetId = "ks76evkn8vmj8jaz5690n543kh8b9bb3";
const inklId = "623d54bae7845e0f3f512b6899b24244";
const bangkokPostId = "js780vs62f7gayyrzsjwgmp2ph8b8agc";
const provenanceId = "bangkok-post-2026-07-neighbours-swap-citizens";

test("Jul 24 Khlong Luek return uses captured Bangkok Post republication", () => {
  const timeline = readFileSync("data/timeline/2026-07.jsonl", "utf8").trim().split(/\r?\n/u).map(JSON.parse);
  const event = timeline.find((item) => item.id === targetId);
  assert.equal(event.date, "2026-07-24");
  assert.equal(event.timeOfDay, undefined);
  assert.deepEqual(event.evidenceIds, [inklId]);
  assert.match(event.description, /36 Thai nationals/u);
  assert.match(event.description, /67 Cambodian nationals/u);
  assert.match(event.description, /43 men, 21 women and three boys/u);
  assert.doesNotMatch(event.description, /all 103 people/u);

  const news = readFileSync("data/news/2026-07.jsonl", "utf8").trim().split(/\r?\n/u).map(JSON.parse);
  const inkl = news.find((item) => item.id === inklId);
  const bangkokPost = news.find((item) => item.id === bangkokPostId);
  assert.equal(inkl.provenanceId, provenanceId);
  assert.equal(bangkokPost.provenanceId, provenanceId);
  assert.equal(news.some((item) => item.id === "7e6877f1d0963203780863b273a823dc"), false);
});
