import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJsonl(path) {
  return readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
}

test("Victory Bridge record does not absorb conflict-wide hotel damage totals", () => {
  const event = readJsonl("data/timeline/2025-12.jsonl")
    .find((row) => row.id === "ks742c1434pqpm0rt87dhj5m15812j2a");
  assert.ok(event);
  assert.equal(event.date, "2025-12-13");
  assert.equal(event.timeOfDay, undefined);
  assert.match(event.title, /Victory Bridge/u);
  assert.match(event.description, /National Road 55/u);
  assert.match(event.description, /Cambodian authorities described the bridge as public or civilian infrastructure/u);
  assert.match(event.description, /Thai military reporting said it was a logistics route/u);
  assert.doesNotMatch(`${event.title} ${event.description}`, /10 hotels|10 apartments|tourism safety|collapse in local tourism/iu);
  assert.ok(!event.evidenceIds.includes("jn79hccatesx166cn3fy5dyysd7xeqy0"));
  assert.deepEqual(event.evidenceIds, [
    "jn7570cd1b4a6b051f2f992fb957cab0",
    "jnc63eae433194c20982be58db5e4d92",
    "js7ckaka96d1zzj8cv0w0drbax7x7ave",
    "jn784s3ar096dc83cnnx31q6rd7x64at",
    "jnf9b80271d972d7a5815ac191f3a49b",
    "k97d9ztxc5bsjb4nxj3rzz51tx7x9gx4",
  ]);
});
