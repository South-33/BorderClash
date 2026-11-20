import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJsonl(path) {
  return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
}

const marchEventId = "ks79wr4xvbpcdv1y568de4087h849ddm";
const aprilEventId = "ks76m0s6g3h4g3wt33e9tc5q6d84j5gv";
const marchArticleId = "jn771p2pz2vttj199fwfk8dkyd848sc4";
const aprilArticleId = "jn7dk75d64k5jmbwj7dpbnkbx584j5ph";

test("March 2 displacement snapshot is restored from the misfiled April 5 row", () => {
  const march = readJsonl("data/timeline/2026-03.jsonl");
  const april = readJsonl("data/timeline/2026-04.jsonl");
  const event = march.find((row) => row.id === marchEventId);
  assert.ok(event);
  assert.equal(event.date, "2026-03-02");
  assert.equal(event.timeOfDay, "06:00");
  assert.match(event.title, /49,331 Still Unable to Return Home/u);
  assert.match(event.description, /25,831 women/u);
  assert.match(event.description, /16,331 children/u);
  assert.match(event.description, /over 92%/u);
  assert.match(event.description, /Cambodian government reporting/u);
  assert.equal(april.some((row) => row.id === marchEventId), false);
});

test("April 9 snapshot uses the ministry update cutoff instead of unsupported 16:00", () => {
  const april = readJsonl("data/timeline/2026-04.jsonl");
  const event = april.find((row) => row.id === aprilEventId);
  assert.ok(event);
  assert.equal(event.date, "2026-04-09");
  assert.equal(event.timeOfDay, "06:00");
  assert.match(event.title, /34,867 Still Unable to Return Home/u);
  assert.match(event.description, /18,103 women/u);
  assert.match(event.description, /11,584 children/u);
  assert.match(event.description, /about 94%/u);
  assert.match(event.description, /Cambodian government reports and allegations/u);
});

test("all languages preserve the snapshot counts and 06:00 cutoff", () => {
  const events = [
    readJsonl("data/timeline/2026-03.jsonl").find((row) => row.id === marchEventId),
    readJsonl("data/timeline/2026-04.jsonl").find((row) => row.id === aprilEventId),
  ];
  for (const [event, count] of [[events[0], "49,331"], [events[1], "34,867"]]) {
    assert.ok(event);
    for (const field of ["description", "descriptionTh", "descriptionKh"]) {
      assert.match(event[field], /06:00/u);
      assert.match(event[field], new RegExp(count.replace(",", ","), "u"));
    }
  }
});

test("DAP evidence is stored in March with its published date, not April fetch time", () => {
  const march = readJsonl("data/news/2026-03.jsonl");
  const april = readJsonl("data/news/2026-04.jsonl");
  const article = march.find((row) => row.id === marchArticleId);
  assert.ok(article);
  assert.equal(article.publishedAt, Date.parse("2026-03-02T00:00:00Z"));
  assert.equal(article.provenanceId, "cambodia-interior-displacement-2026-03-02");
  assert.match(article.summary, /06:00 on March 1 to 06:00 on March 2/u);
  assert.equal(april.some((row) => row.id === marchArticleId), false);

  const aprilArticle = april.find((row) => row.id === aprilArticleId);
  assert.equal(aprilArticle?.provenanceId, "cambodia-interior-displacement-2026-04-09");
  assert.match(aprilArticle?.summary ?? "", /06:00 on April 8 to 06:00 on April 9/u);
});
