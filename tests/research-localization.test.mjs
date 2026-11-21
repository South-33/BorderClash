import test from "node:test";
import assert from "node:assert/strict";
import { getLocalizedTextIssue, getLocalizedTextIssueDetails, normalizeLocalizedDigits } from "../research/lib/localization.mjs";

test("normalizes Thai and Khmer numerals to ASCII", () => {
  assert.equal(normalizeLocalizedDigits(String.fromCodePoint(0x17f0, 0x17f1, 0x17f2)), "012");
  assert.equal(normalizeLocalizedDigits("ปี ๒๐๒๖ និង ២០២៦"), "ปี 2026 និង 2026");
});

test("rejects cross-script localization", () => {
  assert.equal(getLocalizedTextIssue("ข่าวไทย ខ្មែរ", "th"), "wrong-script");
  assert.equal(getLocalizedTextIssue("ព័ត៌មាន ไทย", "kh"), "wrong-script");
});

test("requires target script", () => {
  assert.equal(getLocalizedTextIssue("Border update 2026", "th"), "no-target-script");
  assert.equal(getLocalizedTextIssue("Border update 2026", "kh"), "no-target-script");
});


test("reports the exact unexpected script characters", () => {
  const details = getLocalizedTextIssueDetails("ព័ត៌មាន อา", "kh");
  assert.equal(details.issue, "wrong-script");
  assert.deepEqual(details.unexpectedCharacters, [
    { text: "อ", codePoint: "U+0E2D", index: 8, script: "Thai" },
    { text: "า", codePoint: "U+0E32", index: 9, script: "Thai" },
  ]);
});
