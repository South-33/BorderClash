import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(path, "utf8").trim().split(/\r?\n/u).map(JSON.parse);
const id = "ks79t58zx3gsfrtkh6mfdqkcwd8f9tw8";

test("Sep 28 Thai right-of-reply row stays within the captured mission statement", () => {
  const row = read("data/timeline/2026-09.jsonl").find((item) => item.id === id);
  assert.ok(row);
  assert.equal(row.date, "2026-09-28");
  assert.equal(row.timeOfDay, undefined);
  assert.deepEqual(row.evidenceIds, ["43332f6ff599a8acf50ba6d8407c1175"]);
  assert.match(row.description, /Right of Reply/u);
  assert.match(row.description, /temporary shelters in the 1970s/u);
  assert.match(row.description, /constructive engagement in UNCLOS conciliation/u);
  assert.match(row.description, /Thailand's stated positions/u);
  assert.doesNotMatch(row.description, /20,000|September 26|at the close of|16:00/u);
  assert.doesNotMatch(`${row.titleTh}${row.descriptionTh}${row.titleKh}${row.descriptionKh}`, /\uFFFD/u);
});

test("Sep 28 cites only the captured Thai Mission right of reply", () => {
  const source = read("data/news/2026-09.jsonl").find(
    (item) => item.id === "43332f6ff599a8acf50ba6d8407c1175",
  );
  assert.ok(source);
  assert.match(source.source, /Permanent Mission of Thailand/u);
  assert.match(source.summary, /September 28/u);
  assert.doesNotMatch(source.summary, /20,000/u);
});
