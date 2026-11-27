import assert from "node:assert/strict";
import test from "node:test";
import {
  CURRENT_CENTER_COPY_BUDGET,
  currentCenterCopyBudgetIssues,
  currentCenterCopyUsage,
  graphemeCount,
} from "../research/lib/current-copy-budget.mjs";

function update(text, textTh = "ข่าวสั้น", textKh = "ព័ត៌មានខ្លី") {
  return { text, textTh, textKh, evidenceIds: ["fixture"] };
}

test("center copy budget measures grapheme clusters across all three languages", () => {
  assert.equal(graphemeCount("กำ", "th"), 1);
  assert.equal(graphemeCount("កំ", "km"), 1);

  const summary = {
    summary: "Calm border.",
    summaryTh: "ชายแดนสงบ",
    summaryKh: "ព្រំដែនស្ងប់ស្ងាត់",
    keyUpdates: [update("Talks continue.")],
  };
  const usage = currentCenterCopyUsage(summary);
  assert.equal(usage.keyUpdates, 1);
  assert.ok(usage.languages.en.totalGraphemes > 0);
  assert.ok(usage.languages.th.totalGraphemes > 0);
  assert.ok(usage.languages.kh.totalGraphemes > 0);
  assert.deepEqual(currentCenterCopyBudgetIssues(summary), []);
});

test("center copy budget rejects an oversized summary, individual update, total, or fifth update", () => {
  const summary = {
    summary: "x".repeat(CURRENT_CENTER_COPY_BUDGET.summaryGraphemes.en + 1),
    summaryTh: "ก".repeat(CURRENT_CENTER_COPY_BUDGET.summaryGraphemes.th + 1),
    summaryKh: "ក".repeat(CURRENT_CENTER_COPY_BUDGET.summaryGraphemes.kh + 1),
    keyUpdates: [
      update("a".repeat(CURRENT_CENTER_COPY_BUDGET.keyUpdateGraphemes.en + 1)),
      update("b".repeat(CURRENT_CENTER_COPY_BUDGET.keyUpdateGraphemes.en)),
      update("c".repeat(CURRENT_CENTER_COPY_BUDGET.keyUpdateGraphemes.en)),
      update("d".repeat(CURRENT_CENTER_COPY_BUDGET.keyUpdateGraphemes.en)),
      update("e".repeat(CURRENT_CENTER_COPY_BUDGET.keyUpdateGraphemes.en)),
    ],
  };
  const issues = currentCenterCopyBudgetIssues(summary);
  assert.ok(issues.some((issue) => /keyUpdates 5 exceeds 4/u.test(issue)));
  assert.ok(issues.some((issue) => /en summary .* exceeds 340/u.test(issue)));
  assert.ok(issues.some((issue) => /en keyUpdate\[0\].* exceeds 160/u.test(issue)));
  assert.ok(issues.some((issue) => /en total .* exceeds 960/u.test(issue)));
});
