import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { auditTimelineTimeProvenance } from "../research/lib/time-provenance-audit.mjs";

function readJsonlDir(dir) {
  return readdirSync(dir)
    .filter((file) => file.endsWith(".jsonl"))
    .flatMap((file) => readFileSync(join(dir, file), "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse));
}

test("reviewed publication-time leaks stay date-only and source publication metadata stays accurate", () => {
  const timeline = new Map(readJsonlDir("data/timeline").map((row) => [row.id, row]));
  const news = new Map(readJsonlDir("data/news").map((row) => [row.id, row]));

  for (const id of [
    "ks7eazhdgzqw5wp2zmcvqftv0x88yec1",
    "ks72qecfb0yr2awgcp36tcg25d85q4gy",
    "ks7f96vtq164v13njvfcpz8j9n88we0s",
    "ks712p9te23mac951901mv76dn81xctm",
    "ks74dmrstkwrnmyc4tepf6rqts8919h7",
    "ks7b3gdz1f3s43cvdepjg2bjxn812cn9",
    "ks77qtccn4yr8myvba808a2jk584t4qq",
    "ks7dw7ay26gfanrqfqj9ptxpy5813j2k",
    "ks79w8gk1v8kja00h4zdxarx19813nvz",
    "ks76qc27csqyr01z6razk7xvwh82pjw0",
    "ks7f6ka55xf0e4gw5b01v0abrs812bbx",
    "ks7csxkbhgf5pstmhwxw5mfkvn812svz",
    "ks79rcnk1ae78yqwwhyemfcta583zzmv",
    "ks7bghb9pvnd31gekt10sw0zqd815btk",
    "ks71nqv9m9zcveb0hc9vjkc1ch812fps",
    "ks77395rgtc1455p2fbhs8g1as8124za",
  ]) {
    assert.equal(Boolean(timeline.get(id)?.timeOfDay), false, `${id} regained unsupported exact time`);
  }

  assert.equal(news.get("js7d6m4j2bqbkdqcfzapf4svan88zc9h")?.publishedAt, 1781869020000);
  assert.equal(news.get("js7b4wkvy5mmxmkmr0arm4stns85pxh8")?.publishedAt, 1777311480000);
  assert.equal(news.get("k97a6y26m4z8vasqpr0pgf1s457y4zf9")?.publishedAt, 1766841300000);
  assert.equal(news.get("jn74628f8cbd084e520be15dbd8268a8")?.publishedAt, 1765504980000);
  assert.equal(news.get("k97exxbqjm0t3dm7gq9wetp2h584t9tv")?.publishedAt, 1774338960000);
  assert.equal(news.get("k97djv2vd5q6q7sy81g9qrzres80s3zs")?.publishedAt, 1770512520000);
  assert.equal(news.get("js7at5szk5qg9kce6342dtsrcn7xj73k")?.publishedAt, 1766127780000);
  assert.match(news.get("jn7ftcrnrm75etb47smk5rwefx822pbz")?.summary || "", /10:00am/u);
  assert.equal(timeline.get("ks7d7w2gtgfvjza2zgr2kzd0pn81z05y")?.timeOfDay, "10:00");
  assert.equal(news.get("js7cak9wg9tq9w3mdfnfzvbysh7xfcm5")?.publishedAt, 1765426260000);
  assert.match(news.get("js7cak9wg9tq9w3mdfnfzvbysh7xfcm5")?.summary || "", /09:00/u);
  assert.equal(timeline.get("ks75dj9n39wdq21mw467em66bs8138kf")?.timeOfDay, "09:00");
  assert.match(news.get("js7a0bagknv88f3gsfw2v4em5d80c6nc")?.summary || "", /\bat 21:00\b/iu);
  assert.equal(timeline.get("ks7am0pycmygzn6b73s1v5nns98130rp")?.timeOfDay, "21:00");
  assert.equal(timeline.get("ks756zkg1kqmrt38h62fk2vh6s813qag")?.date, "2026-02-06");
  assert.equal(timeline.get("ks756zkg1kqmrt38h62fk2vh6s813qag")?.timeOfDay, undefined);
});

test("time provenance review has no remaining publication-time collision candidates", () => {
  const timeline = readJsonlDir("data/timeline");
  const news = readJsonlDir("data/news");
  const result = auditTimelineTimeProvenance(timeline, news);

  assert.equal(result.candidateCount, 0);
  assert.equal(result.missingEvidence.length, 0);
  assert.equal(timeline.find((row) => row.id === "ks79nr1kzdnzfxph66xs8vkj85813fx8")?.timeOfDay, undefined);
  assert.equal(timeline.find((row) => row.id === "ks797pq05g5gr52n8ascx580y58133nr")?.timeOfDay, "14:05");
  assert.equal(timeline.find((row) => row.id === "ebcb7de2fcf2e181a459f81f83bc5bf1")?.timeOfDay, "14:15");
});
