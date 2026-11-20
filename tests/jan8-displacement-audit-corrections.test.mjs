import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJsonl(path) {
  return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
}

test("Jan 8 displacement snapshot uses the NCDM counts without unsupported percentage or causes", () => {
  const timeline = readJsonl("data/timeline/2026-01.jsonl");
  const event = timeline.find((row) => row.id === "ks73dfwrxm77hzmpzvb8ef3pth813gjv");

  assert.ok(event);
  assert.equal(event.date, "2026-01-08");
  assert.equal(event.timeOfDay, undefined);
  assert.match(event.title, /173,776/u);
  assert.match(event.description, /475,387 people had returned home/u);
  assert.match(event.description, /173,776 remained/u);
  assert.match(event.description, /649,018 people displaced at the December 27 peak/u);
  assert.doesNotMatch(event.description, /71%|71\.2|landmine|UXO/iu);
  assert.deepEqual(event.evidenceIds, ["k97fqnkvtpb2njhn5f7xwz07p97z25e0"]);
});
