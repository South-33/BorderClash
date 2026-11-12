type LocalizedLanguage = "th" | "kh";

const THAI_RE = /[\u0E00-\u0E7F]/u;
const KHMER_RE = /[\u1780-\u17FF]/u;
const NATIVE_DIGIT_RE = /[\u0E50-\u0E59\u17E0-\u17E9]/gu;
const BAD_TEXT_RE = /(?:\uFFFD|\u00C3.|\u00C2.|\u00E2[\u0080-\u00BF]|\u00F0\u0178|\u00EF\u00BB\u00BF|[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F])/u;

export function normalizeLocalizedDigits(value: string): string {
    return value.replace(NATIVE_DIGIT_RE, (digit) => {
        const codePoint = digit.codePointAt(0)!;
        if (codePoint >= 0x0E50 && codePoint <= 0x0E59) {
            return String(codePoint - 0x0E50);
        }
        return String(codePoint - 0x17E0);
    });
}

type LocalizedTextIssue = "missing" | "wrong-script" | "no-target-script" | "bad-text";
export type LocalizedStyleIssue = "side-taking-tone" | "chatty-or-loaded-tone" | "non-neutral-country-label";

function getLocalizedTextIssue(
    value: unknown,
    language: LocalizedLanguage,
): LocalizedTextIssue | null {
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

export function isValidLocalizedText(value: unknown, language: LocalizedLanguage): value is string {
    return getLocalizedTextIssue(value, language) === null;
}

// High-confidence fallback checks for older localized copy already in the archive.
export function getLocalizedStyleIssue(
    value: unknown,
    language: LocalizedLanguage,
    englishSource: unknown = "",
): LocalizedStyleIssue | null {
    if (typeof value !== "string" || !value.trim()) return null;
    const english = typeof englishSource === "string" ? englishSource : "";
    const englishFirstPerson = /\b(?:we|our|ours|us)\b/i.test(english);

    if (language === "th") {
        if (!englishFirstPerson && /(?:\u0E40\u0E23\u0E32|\u0E1E\u0E35\u0E48\u0E19\u0E49\u0E2D\u0E07|\u0E1E\u0E35\u0E48\u0E44\u0E17\u0E22)/u.test(value)) {
            return "side-taking-tone";
        }
        if (/(?:\u0E19\u0E30\u0E08\u0E4A\u0E30|\u0E08\u0E4A\u0E30|\u0E0B\u0E30\u0E07\u0E31\u0E49\u0E19|\u0E40\u0E09\u0E22\u0E46|\u0E42\u0E27\u0E22|\u0E2A\u0E27\u0E19\u0E01\u0E25\u0E31\u0E1A|\u0E40\u0E1A\u0E35\u0E49\u0E22\u0E27\u0E19\u0E31\u0E14|\u0E14\u0E48\u0E32\u0E01\u0E23\u0E32\u0E14|\u0E2E\u0E38\u0E1A|\u0E08\u0E31\u0E14\u0E2B\u0E19\u0E31\u0E01|\u0E41\u0E09)/u.test(value)) {
            return "chatty-or-loaded-tone";
        }
        if (/\u0E40\u0E02\u0E21\u0E23(?!\u0E41\u0E14\u0E07)/u.test(value)
            && /\bCambodia(?:n)?\b/i.test(english)
            && !/\bKhmer\b/i.test(english)) {
            return "non-neutral-country-label";
        }
        return null;
    }

    if (!englishFirstPerson && /(?:\u1799\u17BE\u1784|\u1794\u1784\u1794\u17D2\u17A2\u17BC\u1793)/u.test(value)) {
        return "side-taking-tone";
    }
    if (/\u1796\u17BD\u1780\u1790\u17C3/u.test(value)) return "chatty-or-loaded-tone";
    if (/\u179F\u17C0\u1798(?!\u179A\u17B6\u1794)/u.test(value)
        && /\b(?:Thailand|Thai)\b/i.test(english)
        && !/\bSiam\b/i.test(english)) {
        return "non-neutral-country-label";
    }
    return null;
}
