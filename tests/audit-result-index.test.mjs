import assert from "node:assert/strict";
import { join, resolve } from "node:path";
import test from "node:test";
import {
  auditReviewIndexPath,
  reviewPacketIsCurrent,
  sha256Text,
} from "../research/lib/audit-result-index.mjs";

test("audit review index uses one stable filename per record", () => {
  const root = resolve(".work", "test-review-root");
  assert.equal(
    auditReviewIndexPath("current/summary", { root }),
    join(root, "latest-by-record", "current%2Fsummary.json"),
  );
});

test("review packet freshness is content-addressed", () => {
  const packet = "{\"id\":\"timeline-1\"}\n";
  const index = { packetSha256: sha256Text(packet) };
  assert.equal(reviewPacketIsCurrent(index, packet), true);
  assert.equal(reviewPacketIsCurrent(index, `${packet} `), false);
});
