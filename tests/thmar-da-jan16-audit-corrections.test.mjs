import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJsonl(path) {
  return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
}

test("Jan 16 Thmar Da row records the razor-wire action without inventing permanent fortifications", () => {
  const timeline = readJsonl("data/timeline/2026-01.jsonl");
  const event = timeline.find((row) => row.id === "ks7era9jdnaq6719t23ysevz5s813ee3");
  const news = readJsonl("data/news/2026-01.jsonl");
  const evidenceIds = [
    "jn76yp843k24sq7xbnvzsv4ran7zxagc",
    "jn7bc30k9b7fsargwtqkwn1qqd7zfsqn",
    "js74ef7pab7ef74jy84yfbs4t57zjr2s",
  ];
  const sharedStatementIds = [
    "jn76yp843k24sq7xbnvzsv4ran7zxagc",
    "jn7bc30k9b7fsargwtqkwn1qqd7zfsqn",
    "jn75dzhzbt6m12s7mnprgxfbrd7zenkh",
    "js7eyj4qsbc93s9b031d9py4hs7zfzgj",
    "jn7aqnkz3yt5034fsjtv3r81j17zf2zd",
    "k979617e61w04r74attyfw86w17zrvvg",
    "js74ef7pab7ef74jy84yfbs4t57zjr2s",
    "js7fb4bb1mqhc5z8ng84nhqvg17zkddd",
    "jn72gc9dq3avrs6nbb2mf0x7k57zepnj",
  ];

  assert.ok(event);
  assert.equal(event.date, "2026-01-16");
  assert.equal(event.timeOfDay, undefined);
  assert.match(event.title, /Reinstall Razor Wire/u);
  assert.doesNotMatch(`${event.title} ${event.description}`, /permanent fortifications/iu);
  assert.match(event.description, /Foreign Ministry formally protested on January 17/u);
  assert.match(event.description, /does not independently establish that sovereignty claim/u);
  assert.deepEqual(event.evidenceIds, evidenceIds);
  for (const id of sharedStatementIds) {
    assert.equal(news.find((row) => row.id === id)?.provenanceId, "cambodia-mfa-jan17-thmar-da-protest");
  }
});
