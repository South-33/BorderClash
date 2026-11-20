import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJsonl(path) {
  return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
}

test("French border-document request keeps the earliest stable ID and the Feb 4 event date", () => {
  const timeline = readJsonl("data/timeline/2026-02.jsonl");
  const news = readJsonl("data/news/2026-02.jsonl");
  const survivor = timeline.find((row) => row.id === "ks790mehng9m09c68vvrv641tx812rvg");
  assert.ok(survivor);
  assert.equal(survivor.date, "2026-02-04");
  assert.equal(survivor.timeOfDay, undefined);
  assert.match(survivor.title, /Requests French Border Records/u);
  assert.match(survivor.description, /wrote to French President Emmanuel Macron/u);
  assert.match(survivor.description, /did not itself determine the boundary or resolve the dispute/u);
  assert.doesNotMatch(survivor.description, /over 140 deaths|finalize border demarcation/iu);
  assert.equal(timeline.some((row) => row.id === "ks7frzpwt7evsxa7drfzqxwbsx8128pt"), false);
  assert.deepEqual(survivor.evidenceIds, [
    "k97b1ey7rgx9k42zc8w2whxkjh80jktf",
    "js79057am13s113c4mxs98zcz180xcqw",
    "jn7cypas32dtcf75p2ynjtg62s80k0w6",
  ]);

  const provenance = "cambodia-mfa-feb4-france-border-documents";
  for (const id of [
    "k97b1ey7rgx9k42zc8w2whxkjh80jktf",
    "k978gwkx6fpa6rynzktfajb7z980rh7p",
    "k9730q6sh9qk6sjcretxx1ygcn80z72k",
    "js77jyyehzsz6566f5dyj78vms80ktfc",
    "jn7cypas32dtcf75p2ynjtg62s80k0w6",
    "js7ehnakakthy64kh7cqwb21zn80kagt",
    "js79057am13s113c4mxs98zcz180xcqw",
    "jn7fx0dkfch0awjmhdzn8jtt6980m31z",
    "jn7aq5366fnbyyk100dpkrt56h80tz48",
    "jn76cgm814qs9xj0css8dxh8cd80wmqe",
    "jn74d2d2fgqfezfhmtnf98raen80w9t9",
    "44f71a72a3100a8196f557bf2e55d323",
  ]) {
    assert.equal(news.find((row) => row.id === id)?.provenanceId, provenance);
  }
});
