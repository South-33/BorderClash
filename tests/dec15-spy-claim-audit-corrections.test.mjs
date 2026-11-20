import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const id = "ks76b5xk6b5tvcqrhezhhpvv4x812bz0";
const rows = readFileSync("data/timeline/2025-12.jsonl", "utf8")
  .trim().split(/\r?\n/u).map(JSON.parse);
const row = rows.find((item) => item.id === id);

test("Dec 15 spy row stays within the captured Cambodian security-source claim", () => {
  assert.ok(row);
  assert.equal(row.date, "2025-12-15");
  assert.equal(row.timeOfDay, undefined);
  assert.deepEqual(row.evidenceIds, ["js7dfx4z9x3aqjhevnd6gak81d7xbsh2"]);
  assert.match(row.title, /Security Sources Claim/u);
  assert.match(row.description, /suspected of spying for Thailand/u);
  assert.match(row.description, /Chong Kal–Srei Snam/u);
  assert.doesNotMatch(row.description, /paid by Thai intelligence|Victory Bridge/u);
});
