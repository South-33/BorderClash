const THAI_RE = /[\u0E00-\u0E7F]/u;
const KHMER_RE = /[\u1780-\u17FF]/u;
const NATIVE_DIGIT_RE = /[\u0E50-\u0E59\u17E0-\u17E9\u17F0-\u17F9]/gu;
const BAD_TEXT_RE = /(?:\uFFFD|\u00C3.|\u00C2.|\u00E2[\u0080-\u00BF]|\u00F0\u0178|\u00EF\u00BB\u00BF|[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F])/u;

export function normalizeLocalizedDigits(value) {
  return value.replace(NATIVE_DIGIT_RE, (digit) => {
    const codePoint = digit.codePointAt(0);
    if (codePoint >= 0x0e50 && codePoint <= 0x0e59) {
      return String(codePoint - 0x0e50);
    }
    if (codePoint >= 0x17e0 && codePoint <= 0x17e9) {
      return String(codePoint - 0x17e0);
    }
    return String(codePoint - 0x17f0);
  });
}

export function getLocalizedTextIssue(value, language) {
  if (typeof value !== "string" || !value.trim()) return "missing";
  if (BAD_TEXT_RE.test(value)) return "bad-text";

  if (language === "th") {
    if (KHMER_RE.test(value)) return "wrong-script";
    if (!THAI_RE.test(value)) return "no-target-script";
    return null;
  }

  if (THAI_RE.test(value)) return "wrong-script";
  if (!KHMER_RE.test(value)) return "no-target-script";
  return null;
}

function scriptNameForCodePoint(codePoint) {
  if (codePoint >= 0x0e00 && codePoint <= 0x0e7f) return "Thai";
  if (codePoint >= 0x1780 && codePoint <= 0x17ff) return "Khmer";
  return "";
}

export function getLocalizedTextIssueDetails(value, language) {
  const issue = getLocalizedTextIssue(value, language);
  if (!issue || typeof value !== "string") return { issue, unexpectedCharacters: [] };

  const unexpectedRange = language === "th"
    ? (codePoint) => codePoint >= 0x1780 && codePoint <= 0x17ff
    : (codePoint) => codePoint >= 0x0e00 && codePoint <= 0x0e7f;
  const unexpectedCharacters = [];
  let codeUnitIndex = 0;
  for (const character of value) {
    const codePoint = character.codePointAt(0);
    if (issue === "wrong-script" && unexpectedRange(codePoint)) {
      unexpectedCharacters.push({
        text: character,
        codePoint: `U+${codePoint.toString(16).toUpperCase().padStart(4, "0")}`,
        index: codeUnitIndex,
        script: scriptNameForCodePoint(codePoint),
      });
    }
    codeUnitIndex += character.length;
  }

  return { issue, unexpectedCharacters };
}
