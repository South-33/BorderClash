import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJsonl(path) {
  return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
}

test("border compensation milestone is anchored to the March 6 DDPM report, not March 5", () => {
  const timeline = readJsonl("data/timeline/2026-03.jsonl");
  const event = timeline.find((row) => row.id === "ks7dwk3hdkbxxa97ty115cp9n982k0fp");

  assert.ok(event);
  assert.equal(event.date, "2026-03-06");
  assert.equal(event.timeOfDay, undefined);
  assert.equal(event.title, "DDPM Reports Border Compensation Fully Paid");
  assert.match(event.description, /695,945 households/u);
  assert.match(event.description, /3\.313 billion baht/u);
  assert.match(event.description, /February 20, 2026/u);
  assert.doesNotMatch(event.description, /finalized.*March 5|primary state-led compensation effort/iu);
});

test("compensation evidence preserves exact publisher time and shared March 9 government provenance", () => {
  const news = readJsonl("data/news/2026-03.jsonl");
  const byId = new Map(news.map((row) => [row.id, row]));
  const bangkokBiz = byId.get("js78prf6qbkckazamq8qc4fq2x82gdtk");

  assert.equal(bangkokBiz?.publishedAt, Date.parse("2026-03-06T14:28:00+07:00"));
  assert.match(bangkokBiz?.summary || "", /695,945 households/u);
  assert.match(bangkokBiz?.summary || "", /388,757 households/u);
  assert.match(bangkokBiz?.summary || "", /February 20, 2026 at 17:30/u);

  for (const id of ["js77sakpggrsvf1fezg5vwmckd82j0sc", "js764nrzvs8tf436jzgn3xd7dh82qn2k"]) {
    assert.equal(byId.get(id)?.provenanceId, "thai-gov-spokesperson-border-compensation-mar9");
  }
});
