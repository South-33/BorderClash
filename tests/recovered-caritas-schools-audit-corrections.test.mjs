import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function rows(path) {
  return readFileSync(path, "utf8").trim().split(/\r?\n/u).map(JSON.parse);
}

test("Caritas emergency appeal uses the captured Dec 23 launch date", () => {
  const event = rows("data/timeline/2025-12.jsonl").find((item) => item.id === "ks7dntq4smwe25cgz3xkw00x2s813s16");
  assert.equal(event.date, "2025-12-23");
  assert.equal(event.timeOfDay, undefined);
  assert.deepEqual(event.evidenceIds, ["jn7dh1pkwc9r1ac97y05d5bted7y91ga"]);
  assert.match(event.description, /5,000 displaced families across 20 priority evacuation camps/u);
  assert.match(event.description, /no exact launch time/u);
});

test("Oddar Meanchey school reopening row stays within the captured ministry figure", () => {
  const event = rows("data/timeline/2026-01.jsonl").find((item) => item.id === "ks7699zx01j4k2wssvtvtw2n81813ath");
  assert.equal(event.date, "2026-01-02");
  assert.equal(event.timeOfDay, undefined);
  assert.deepEqual(event.evidenceIds, ["jn7378b3jz4zn0dsptj9j3bxr17ye8ed"]);
  assert.match(event.description, /101 of 260 educational institutions/u);
  assert.match(event.description, /as of that morning/u);
  assert.doesNotMatch(event.description, /first major wave/u);
});
