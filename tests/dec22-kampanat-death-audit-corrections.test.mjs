import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const id = "ks7fxyfda81kpysc18ykamgp4d812vsd";
const row = () => readFileSync("data/timeline/2025-12.jsonl", "utf8")
  .trim().split(/\r?\n/u).map(JSON.parse).find((r) => r.id === id);

test("Dec 22 Kampanat death is grounded in captured same-day sources", () => {
  const event = row();
  assert.ok(event);
  assert.equal(event.date, "2025-12-22");
  assert.equal(event.timeOfDay, "11:00");
  assert.deepEqual(event.evidenceIds, ["6f9bf7749752fb2ead68d3543eaf39d2","34ca551f98c36c5f900950c0584fc089"]);
  assert.match(event.title, /Kampanat Thongsaeng/u);
  assert.match(event.description, /Ban Khlong Phaeng/u);
  assert.match(event.description, /JS100 reported the same death at 11:00/u);
});

test("Dec 22 Kampanat row removes unsupported conflated battlefield details", () => {
  const event = row();
  assert.match(event.description, /do not support the prior claims/u);
  assert.match(event.description, /FPV drones/u);
  assert.match(event.description, /retaliatory airstrikes/u);
});
