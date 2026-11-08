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

export function isValidLocalizedText(value, language) {
  return getLocalizedTextIssue(value, language) === null;
}

export function normalizeLocalizedRecord(value) {
  if (Array.isArray(value)) {
    return value.map(normalizeLocalizedRecord);
  }
  if (!value || typeof value !== "object") {
    return typeof value === "string" ? normalizeLocalizedDigits(value) : value;
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [
      key,
      typeof item === "string" && /(?:Th|Kh)$/u.test(key)
        ? normalizeLocalizedDigits(item)
        : normalizeLocalizedRecord(item),
    ]),
  );
}

