import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const rows = readFileSync("data/timeline/2026-01.jsonl", "utf8").trim().split(/\r?\n/u).map(JSON.parse);
const jan15 = rows.find((item) => item.id === "ks797pq05g5gr52n8ascx580y58133nr");
const jan16 = rows.find((item) => item.id === "ks739m1h9a9wghjjw7k4vy1d2d8122yt");

test("Jan 15 Pursat AOT row uses the captured inspection schedule and attribution", () => {
  assert.equal(jan15.date, "2026-01-15");
  assert.equal(jan15.timeOfDay, "14:05");
  assert.match(jan15.description, /Steung Me Teuk Bridge at 15:16/u);
  assert.match(jan15.description, /responsibility claim is Cambodia's account/u);
});

test("Jan 16 Pursat AOT row keeps the distinct three-site mission", () => {
  assert.equal(jan16.date, "2026-01-16");
  assert.equal(jan16.timeOfDay, "09:12");
  assert.match(jan16.description, /Hun Sen Thmar Da Health Centre at 10:20/u);
  assert.match(jan16.description, /Chey Chumneas Point of Entry at 10:40/u);
  assert.doesNotMatch(jan16.description, /Steung Me Teuk Bridge/u);
});
