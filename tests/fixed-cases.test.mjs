import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { evaluateFixedCase } from "../research/fixed-case-evaluator.mjs";

const cases = JSON.parse(readFileSync("research/fixtures/fixed-cases.json", "utf8"));

function localized(en, th, kh) {
  return { summaryEn: en, summaryTh: th, summaryKh: kh };
}

test("fixed-case catalog contains the required editorial failure modes", () => {
  assert.deepEqual(
    cases.map(({ id }) => id),
    [
      "retrospective-anniversary",
      "disputed-single-chain",
      "humanitarian-claimant-scope",
      "required-source-unavailable",
    ],
  );
});

test("retrospective case rejects publication year and unsupported exact time", () => {
  const fixture = cases.find(({ id }) => id === "retrospective-anniversary");
  const good = {
    caseId: fixture.id,
    decision: "complete",
    eventDate: "2025-05-28",
    eventTime: null,
    credibility: 70,
    independentEvidenceChains: 1,
    ...localized(
      "The fatal clash occurred on 28 May 2025.",
      "เหตุปะทะที่มีผู้เสียชีวิตเกิดขึ้นเมื่อ 28 พฤษภาคม 2025",
      "ការប៉ះទង្គិចដែលបណ្តាលឱ្យមានអ្នកស្លាប់បានកើតឡើងនៅថ្ងៃទី 28 ខែឧសភា ឆ្នាំ 2025",
    ),
  };
  assert.deepEqual(evaluateFixedCase(fixture, good), []);
  assert.ok(evaluateFixedCase(fixture, { ...good, eventDate: "2026-05-28" }).some((error) => /eventDate/u.test(error)));
  assert.ok(evaluateFixedCase(fixture, { ...good, eventTime: "10:00" }).some((error) => /time/u.test(error)));
});

test("disputed case protects structured claimant and evidence-chain semantics", () => {
  const fixture = cases.find(({ id }) => id === "disputed-single-chain");
  const base = {
    caseId: fixture.id,
    decision: "complete",
    eventDate: "2026-02-14",
    claimant: "Cambodian Ministry of National Defence",
    credibility: 80,
    independentEvidenceChains: 1,
    ...localized(
      "The Cambodian Ministry of National Defence says Thai troops crossed the border on 14 February 2026.",
      "กระทรวงกลาโหมกัมพูชาระบุว่าทหารไทยข้ามพรมแดนเมื่อ 14 กุมภาพันธ์ 2026",
      "ក្រសួងការពារជាតិកម្ពុជាបាននិយាយថា ទាហានថៃបានឆ្លងព្រំដែននៅថ្ងៃទី 14 ខែកុម្ភៈ ឆ្នាំ 2026",
    ),
  };
  assert.deepEqual(evaluateFixedCase(fixture, base), []);
  assert.deepEqual(evaluateFixedCase(fixture, {
    ...base,
    summaryEn: "The Cambodian Ministry of National Defence stated that Thai troops crossed the border on 14 February 2026.",
  }), []);
  assert.deepEqual(evaluateFixedCase(fixture, {
    ...base,
    summaryEn: "Thai troops crossed the border on 14 February 2026.",
  }), [], "free-text attribution quality belongs to editorial evaluation, not a regex gate");
  assert.deepEqual(evaluateFixedCase(fixture, { ...base, credibility: 60 }), []);
  assert.ok(evaluateFixedCase(fixture, { ...base, credibility: 65 }).some((error) => /decile/u.test(error)));
  assert.ok(evaluateFixedCase(fixture, { ...base, independentEvidenceChains: 2 }).some((error) => /independentEvidenceChains/u.test(error)));
});

test("humanitarian case preserves claimant, scope, number, qualifier, and unknown combined figure", () => {
  const fixture = cases.find(({ id }) => id === "humanitarian-claimant-scope");
  const result = {
    caseId: fixture.id,
    decision: "complete",
    eventDate: "2025-12-18",
    claimant: "Cambodia Ministry of Interior",
    value: 20000,
    qualifier: "MORE_THAN",
    scope: "Cambodian civilians displaced from 5 border provinces",
    combinedFigureKnown: false,
    ...localized(
      "The ministry reported more than 20,000 Cambodian civilians displaced from 5 border provinces as of 18 December 2025.",
      "กระทรวงรายงานว่าพลเรือนกัมพูชามากกว่า 20,000 คนจาก 5 จังหวัดชายแดนต้องพลัดถิ่น ณ วันที่ 18 ธันวาคม 2025",
      "ក្រសួងបានរាយការណ៍ថា ជនស៊ីវិលកម្ពុជាជាង 20,000 នាក់ពីខេត្តព្រំដែន 5 ត្រូវបានផ្លាស់ទីលំនៅ គិតត្រឹមថ្ងៃទី 18 ខែធ្នូ ឆ្នាំ 2025",
    ),
  };
  assert.deepEqual(evaluateFixedCase(fixture, result), []);
  assert.deepEqual(evaluateFixedCase(fixture, {
    ...result,
    summaryTh: "ณ วันที่ 18 ธันวาคม 2025 มีพลเรือนกัมพูชามากกว่า 20,000 คนจาก 5 จังหวัดชายแดนต้องพลัดถิ่น",
    summaryKh: "គិតត្រឹមថ្ងៃទី 18 ខែធ្នូ ឆ្នាំ 2025 ប្រជាជនស៊ីវិលកម្ពុជាជាង 20,000 នាក់ពីខេត្តជាប់ព្រំដែនចំនួន 5 បានភៀសខ្លួន។",
  }), []);
  assert.ok(evaluateFixedCase(fixture, {
    ...result,
    summaryTh: "ณ วันที่ 18 ธันวาคม 2025 มีพลเรือนกัมพูชามากกว่า 20,000 คนต้องพลัดถิ่น",
  }).some((error) => /numeric claims/u.test(error)));
});

test("required-source failure only passes with a useful review decision", () => {
  const fixture = cases.find(({ id }) => id === "required-source-unavailable");
  assert.deepEqual(evaluateFixedCase(fixture, {
    caseId: fixture.id,
    decision: "review",
    reviewReason: "The required casualty source is unavailable and no independent evidence establishes the value.",
  }), []);
  assert.ok(evaluateFixedCase(fixture, {
    caseId: fixture.id,
    decision: "complete",
  }).length > 0);
});
