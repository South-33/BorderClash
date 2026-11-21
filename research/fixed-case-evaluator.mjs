import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { getLocalizedTextIssue, normalizeLocalizedDigits } from "./lib/localization.mjs";

function numericTokens(value) {
  return String(value || "").match(/\d+(?:[.,]\d+)*/gu)?.map((token) => token.replaceAll(",", "")) || [];
}

function localizedNumbersMatch(english, localized) {
  const expected = numericTokens(english).sort();
  const actual = numericTokens(normalizeLocalizedDigits(String(localized || ""))).sort();
  return JSON.stringify(expected) === JSON.stringify(actual);
}

function add(errors, condition, message) {
  if (!condition) errors.push(message);
}

export function evaluateFixedCase(caseDefinition, result) {
  const expected = caseDefinition.expected || {};
  const errors = [];
  add(errors, result?.caseId === caseDefinition.id, "caseId does not match fixture");
  add(errors, result?.decision === expected.decision, "decision must be " + expected.decision);

  if (expected.decision === "review") {
    add(errors, typeof result?.reviewReason === "string" && result.reviewReason.trim().length >= 10, "review decision needs a useful reason");
    return errors;
  }

  if (expected.eventDate !== undefined) add(errors, result?.eventDate === expected.eventDate, "eventDate must be " + expected.eventDate);
  if (Object.hasOwn(expected, "eventTime")) add(errors, result?.eventTime === expected.eventTime, "unsupported exact time must remain null");
  if (expected.claimant) add(errors, result?.claimant === expected.claimant, "claimant must be " + expected.claimant);
  if (result?.credibility !== undefined && result?.credibility !== null) {
    add(errors, Number.isInteger(result.credibility) && result.credibility >= 0 && result.credibility <= 100 && result.credibility % 10 === 0, "credibility must be a 0..100 decile when provided");
  }
  if (expected.independentEvidenceChains !== undefined) {
    add(errors, result?.independentEvidenceChains === expected.independentEvidenceChains, "independentEvidenceChains must be " + expected.independentEvidenceChains);
  }
  if (expected.value !== undefined) add(errors, result?.value === expected.value, "value must be " + expected.value);
  if (expected.qualifier) add(errors, result?.qualifier === expected.qualifier, "qualifier must be " + expected.qualifier);
  if (expected.scopeContains) {
    for (const fragment of expected.scopeContains) {
      add(errors, String(result?.scope || "").toLowerCase().includes(fragment.toLowerCase()), "scope must include " + fragment);
    }
  }
  if (expected.combinedFigureKnown !== undefined) {
    add(errors, result?.combinedFigureKnown === expected.combinedFigureKnown, "combinedFigureKnown must be " + expected.combinedFigureKnown);
  }

  for (const [language, field] of [["th", "summaryTh"], ["kh", "summaryKh"]]) {
    add(errors, getLocalizedTextIssue(result?.[field], language) === null, field + " must use the target script without mojibake");
    add(errors, localizedNumbersMatch(result?.summaryEn, result?.[field]), field + " must preserve the English numeric claims");
  }
  return errors;
}

async function main() {
  const [casesPath, resultPath] = process.argv.slice(2);
  if (!casesPath || !resultPath) throw new Error("usage: fixed-case-evaluator.mjs <cases.json> <CASE_RESULT.json>");
  const cases = JSON.parse(await readFile(casesPath, "utf8"));
  const result = JSON.parse(await readFile(resultPath, "utf8"));
  const fixture = cases.find(({ id }) => id === result.caseId);
  if (!fixture) throw new Error("unknown fixed case: " + result.caseId);
  const errors = evaluateFixedCase(fixture, result);
  process.stdout.write(JSON.stringify({ ok: errors.length === 0, caseId: result.caseId, errors }, null, 2) + "\n");
  if (errors.length) process.exitCode = 1;
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  main().catch((error) => {
    console.error(error?.stack || String(error));
    process.exitCode = 1;
  });
}
