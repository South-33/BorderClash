import assert from "node:assert/strict";
import test from "node:test";
import { auditReviewPrecheck, capturedTimeMatches } from "../research/lib/audit-review-precheck.mjs";

function packet(timeOfDay = "11:00") {
  return { id: "event-1", kind: "timeline", record: { id: "event-1", timeOfDay }, evidence: { missingEvidenceIds: [], missingDirectSourceUrls: [] } };
}
function captured(texts) {
  const captures = texts.map((text, index) => ({ articleId: `article-${index + 1}`, captureFound: Boolean(text), text: text || "" }));
  return { articleCount: captures.length, capturedCount: captures.filter((item) => item.captureFound).length, captures };
}

test("exact-time precheck recognizes Thai dotted time", () => {
  const result = auditReviewPrecheck(packet("11:00"), captured(["วันที่ 4 มกราคม 2569 เวลา 11.00 น. ศูนย์แถลงข่าวร่วมฯ ชี้แจง"]));
  assert.equal(result.ok, true);
  assert.deepEqual(result.exactTimeMatchedArticleIds, ["article-1"]);
});

test("exact-time precheck recognizes 12-hour meridiem", () => {
  assert.deepEqual(capturedTimeMatches("15:00", [{ articleId: "a", captureFound: true, text: "The briefing began at 3:00 p.m." }]), ["a"]);
});

test("exact-time precheck recognizes Khmer whole-hour morning wording", () => {
  assert.deepEqual(capturedTimeMatches("08:00", [{ articleId: "kh-am", captureFound: true, text: "\u1798\u17c9\u17c4\u1784 \u200b\u17e8 \u200b\u1796\u17d2\u179a\u17b9\u1780" }]), ["kh-am"]);
});

test("exact-time precheck recognizes Khmer numerals", () => {
  assert.deepEqual(capturedTimeMatches("14:05", [{ articleId: "kh", captureFound: true, text: "នៅវេលាម៉ោង ១៤:០៥នាទីរសៀល ក្រុមបានចុះពិនិត្យ។" }]), ["kh"]);
});

test("exact-time precheck recognizes Thai numerals", () => {
  assert.deepEqual(capturedTimeMatches("15:30", [{ articleId: "th", captureFound: true, text: "เมื่อเวลา ๑๕.๓๐ น. นายกรัฐมนตรีลงพื้นที่" }]), ["th"]);
});

test("exact-time precheck blocks reviewer when captured text lacks the canonical exact time", () => {
  const result = auditReviewPrecheck(packet("09:00"), captured(["The project was announced on February 16. Construction had begun in two provinces."]));
  assert.equal(result.ok, false);
  assert.ok(result.blockers.some(({ code }) => code === "exact-time-not-found-in-captured-evidence"));
});

test("one usable capture is enough, while uncaptured citations remain visible as warnings", () => {
  const result = auditReviewPrecheck(packet("11:00"), { articleCount: 2, capturedCount: 1, captures: [
    { articleId: "good", captureFound: true, text: "At 11:00 the center issued its statement." },
    { articleId: "blocked", captureFound: false, text: "" },
  ] });
  assert.equal(result.ok, true);
  assert.deepEqual(result.uncapturedArticleIds, ["blocked"]);
  assert.ok(result.warnings.some(({ code }) => code === "some-cited-evidence-uncaptured"));
});

test("precheck blocks packets with no usable captured publisher evidence", () => {
  const result = auditReviewPrecheck(packet(""), { articleCount: 1, capturedCount: 0, captures: [{ articleId: "missing", captureFound: false, text: "" }] });
  assert.equal(result.ok, false);
  assert.ok(result.blockers.some(({ code }) => code === "no-usable-captured-evidence"));
});

test("precheck blocks unresolved evidence ids before launching a model reviewer", () => {
  const value = packet(""); value.evidence.missingEvidenceIds = ["missing-id"];
  const result = auditReviewPrecheck(value, captured(["publisher text"]));
  assert.equal(result.ok, false);
  assert.ok(result.blockers.some(({ code }) => code === "missing-evidence-ids"));
});

test("deletion review can proceed when the cited publisher body is unavailable", () => {
  const value = {
    id: "event-deleted",
    kind: "timeline",
    proposedAction: "delete",
    record: null,
    baselineRecord: { id: "event-deleted", timeOfDay: "09:20" },
    evidence: { missingEvidenceIds: [], missingDirectSourceUrls: [] },
  };
  const result = auditReviewPrecheck(value, {
    articleCount: 1,
    capturedCount: 0,
    captures: [{ articleId: "blocked", captureFound: false, text: "" }],
  });
  assert.equal(result.ok, true);
  assert.equal(result.exactTime, null);
  assert.ok(result.warnings.some(({ code }) => code === "deletion-without-usable-captured-evidence"));
});


test("deletion review treats missing evidence references as warnings", () => {
  const value = {
    id: "event-deleted-missing",
    kind: "timeline",
    proposedAction: "delete",
    record: null,
    baselineRecord: { id: "event-deleted-missing", timeOfDay: "09:20" },
    evidence: {
      missingEvidenceIds: ["missing-id"],
      missingDirectSourceUrls: ["https://example.com/missing"],
    },
  };
  const result = auditReviewPrecheck(value, { articleCount: 0, capturedCount: 0, captures: [] });
  assert.equal(result.ok, true);
  assert.deepEqual(result.blockers, []);
  assert.ok(result.warnings.some(({ code }) => code === "deletion-missing-evidence-ids"));
  assert.ok(result.warnings.some(({ code }) => code === "deletion-missing-direct-source-urls"));
  assert.ok(result.warnings.some(({ code }) => code === "deletion-without-cited-evidence"));
});
