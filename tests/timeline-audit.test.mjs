import assert from "node:assert/strict";
import test from "node:test";
import { summarizeTimelineTimes } from "../research/lib/timeline-audit.mjs";

test("timeline audit separates exact, date-only, invalid, and suspiciously repeated times", () => {
  const events = [
    ...Array.from({ length: 12 }, (_, index) => ({ id: `ten-${index}`, timeOfDay: "10:00" })),
    { id: "other", timeOfDay: "14:35" },
    { id: "date-only" },
    { id: "bad", timeOfDay: "25:99" },
  ];
  const audit = summarizeTimelineTimes(events);
  assert.equal(audit.timezone, "UTC+07:00");
  assert.equal(audit.totalEvents, 15);
  assert.equal(audit.exactTimeEvents, 13);
  assert.equal(audit.dateOnlyEvents, 1);
  assert.equal(audit.invalidTimeEvents, 1);
  assert.equal(audit.commonTimes[0].timeOfDay, "10:00");
  assert.equal(audit.commonTimes[0].count, 12);
  assert.deepEqual(audit.dateOnlyIds, ["date-only"]);
  assert.deepEqual(audit.invalid, [{ id: "bad", timeOfDay: "25:99" }]);
});
