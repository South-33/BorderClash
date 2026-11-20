import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJsonl(path) {
  return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
}

test("UNCLOS launch sequence keeps one June 2 Cambodian notice and removes restatement duplicates", () => {
  const timeline = readJsonl("data/timeline/2026-06.jsonl");
  const launch = timeline.find((row) => row.id === "ks7ffpj44tarr5s6713ptwaxrn87zmxr");

  assert.ok(launch);
  assert.equal(launch.date, "2026-06-02");
  assert.equal(launch.timeOfDay, undefined);
  assert.match(launch.title, /Transmits UNCLOS Compulsory Conciliation Notice/u);
  assert.match(launch.description, /delivered formal notice to Thailand and the UN Secretary-General/u);
  assert.match(launch.description, /21 days after receipt of the notification/u);
  assert.deepEqual(launch.evidenceIds, [
    "k97ertfcfq6jkafcq95q99d4nx87ywfs",
    "js74bbw4bxvv9phfqnw2xwc2ts880tvm",
  ]);

  for (const id of [
    "ks785q5v1ct8ry1t2phxbh3bhh8877d7",
    "ks750tbcpx9cpvr18qp9cfeq55880aew",
    "ks73y99kgper3meq6m4qapk189886mb4",
    "ks76esxd3sq5f6cc2hp4rhyvjx887hwx",
  ]) {
    assert.equal(timeline.some((row) => row.id === id), false, id);
  }
});

test("Thailand's initial reaction is dated June 3 and distinct from its June 5 participation decision", () => {
  const timeline = readJsonl("data/timeline/2026-06.jsonl");
  const reaction = timeline.find((row) => row.id === "ks718p9a5s3arqteqgt4t7cbvn87zr8g");
  const participation = timeline.find((row) => row.id === "ks780sbdv26f4mzfc3q9qj8t7n885c8g");

  assert.ok(reaction);
  assert.equal(reaction.date, "2026-06-03");
  assert.equal(reaction.timeOfDay, undefined);
  assert.match(reaction.description, /fully prepared/u);
  assert.match(reaction.description, /initial public reaction/u);
  assert.deepEqual(reaction.evidenceIds, ["k97497zgy456mhbpezr6t0ghz987z2zz"]);

  assert.ok(participation);
  assert.equal(participation.date, "2026-06-05");
  assert.equal(participation.timeOfDay, undefined);
  assert.match(participation.description, /would appoint two conciliators and participate/u);
  assert.match(participation.description, /other bilateral talks, including land-border discussions, on hold/u);
  assert.match(participation.description, /June 5 public decision to participate/u);
  assert.equal(timeline.some((row) => row.id === "ks735xnt96tmsfx679vjnw6sa9886hqv"), false);
});

test("wire-derived UNCLOS reports carry bounded shared provenance", () => {
  const news = readJsonl("data/news/2026-06.jsonl");
  const byId = new Map(news.map((row) => [row.id, row]));

  assert.equal(byId.get("k97497zgy456mhbpezr6t0ghz987z2zz")?.provenanceId, "afp-jun3-thailand-unclos-reaction");
  assert.equal(byId.get("k97ertfcfq6jkafcq95q99d4nx87ywfs")?.provenanceId, "associated-press-jun2-cambodia-unclos-launch");
  for (const id of ["k9750aeerkevy0szh6be66dc6s88581c", "js77zc39f1b5fqxk7ggpm07j25885kzp"]) {
    assert.equal(byId.get(id)?.provenanceId, "reuters-jun5-thailand-unclos-participation");
  }
});
