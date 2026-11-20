import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJsonl(path) {
  return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
}

test("Jan 15 RBC row keeps the meeting but removes fake precision and unrelated AOT evidence", () => {
  const timeline = readJsonl("data/timeline/2026-01.jsonl");
  const news = readJsonl("data/news/2026-01.jsonl");
  const event = timeline.find((row) => row.id === "ks7chhrbqmpe0gk5939txa1gfn812xe0");

  assert.ok(event);
  assert.equal(event.date, "2026-01-15");
  assert.equal(event.timeOfDay, undefined);
  assert.match(event.description, /informal Regional Border Committee meeting/u);
  assert.match(event.description, /discussed three practical measures/u);
  assert.match(event.description, /primary liaison contacts/u);
  assert.match(event.description, /landmine clearance/u);
  assert.deepEqual(event.evidenceIds, [
    "k971fx3va96p0thqqgkcdj7a257z9f2m",
    "js7eq0j776ppr54vk03tfnb0sd7z88j1",
    "jn7b1pgranf4jb2wenx05qaj197z8xq1",
  ]);
  assert.equal(event.evidenceIds.includes("jn735ajags86cacdb22b98ykth7za6b7"), false);

  for (const id of [
    "js7eq0j776ppr54vk03tfnb0sd7z88j1",
    "k974fxbf6e03j1prdpmst0dkbh7z8rz9",
    "js7ehfdpjy9avcb3g295mr6mj17z9714",
    "js7esj6akmdn8wj61mzvffjsyh7zay7n",
    "js7cf6vfnvwsv2ned7t92dmps57z9xy1",
    "js78ydypt3v8fwbnmdc43wwnv57z84ss",
  ]) {
    assert.equal(news.find((row) => row.id === id)?.provenanceId, "thai-second-army-jan15-rbc-briefing");
  }
  for (const id of [
    "jn7005q4xqg3pjnn90004z9qv17z9zbg",
    "jn7b1pgranf4jb2wenx05qaj197z8xq1",
  ]) {
    assert.equal(news.find((row) => row.id === id)?.provenanceId, "cambodia-mod-jan15-rbc-meeting");
  }
});
