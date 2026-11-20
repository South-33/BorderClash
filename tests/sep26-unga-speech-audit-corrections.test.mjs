import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(path, "utf8").trim().split(/\r?\n/u).map(JSON.parse);
const id = "ks7drg2083c9zvsyfk33r06trn8f737z";

test("Sep 26 UNGA row uses captured speech text without invented time", () => {
  const row = read("data/timeline/2026-09.jsonl").find((item) => item.id === id);
  assert.ok(row);
  assert.equal(row.date, "2026-09-26");
  assert.equal(row.timeOfDay, undefined);
  assert.deepEqual(row.evidenceIds, [
    "7f35e9d9417454d322299bc41b2eafb9",
    "60518d9a5da07c4b3c1c3e339c00549e",
  ]);
  assert.match(row.description, /Joint Boundary Commission/u);
  assert.match(row.description, /more than 20,000/u);
  assert.match(row.description, /compulsory conciliation under UNCLOS/u);
  assert.match(row.description, /Cambodia's stated positions/u);
  assert.doesNotMatch(row.description, /16:00/u);
  assert.doesNotMatch(`${row.titleTh}${row.descriptionTh}${row.titleKh}${row.descriptionKh}`, /\uFFFD/u);
});

test("Sep 26 evidence rows identify the full UN text and AKP statement", () => {
  const rows = read("data/news/2026-09.jsonl");
  const speech = rows.find((item) => item.id === "7f35e9d9417454d322299bc41b2eafb9");
  const akp = rows.find((item) => item.id === "60518d9a5da07c4b3c1c3e339c00549e");
  assert.ok(speech);
  assert.ok(akp);
  assert.match(speech.source, /GA Speeches/u);
  assert.equal(akp.source, "AKP");
  assert.equal(speech.titleTh, undefined);
  assert.equal(speech.titleKh, undefined);
});
