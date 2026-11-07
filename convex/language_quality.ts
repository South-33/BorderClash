export type LocalizedLanguage = "th" | "kh";

const THAI_RE = /[\u0E00-\u0E7F]/u;
const KHMER_RE = /[\u1780-\u17FF]/u;
const BAD_TEXT_RE = /(?:\uFFFD|\u00C3.|\u00C2.|\u00E2[\u0080-\u00BF]|\u00F0\u0178|\u00EF\u00BB\u00BF|[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F])/u;

/**
 * Shared contract for every user-facing English/Thai/Khmer generation.
 * Keep this short: it is injected into high-frequency Gemini prompts.
 */
export const LOCALIZED_WRITING_RULES = `Writing and translation:
- Write for an ordinary reader with no military, legal, or diplomatic background. Use short, natural sentences and common words.
- English fields use natural English; Thai fields use natural Thai; Khmer fields use natural Khmer.
- Thai output may use Thai script plus normal digits, punctuation, and common Latin acronyms. Khmer output may use Khmer script plus the same. Never mix Thai and Khmer scripts in one field.
- Use the normal target-language form of country and place names when one exists. Never copy a name in the other language's script.
- Translate meaning, attribution, and uncertainty. Do not translate word-for-word and do not add facts.
- Keep disputed claims attributed to whoever made them. Apply the same standard to Thailand and Cambodia.
- Prefer everyday words. Explain an unavoidable military, legal, or diplomatic term in plain language.
- Before returning JSON, silently check every Thai and Khmer field for wrong-script characters and rewrite any field that fails.`;

export type LocalizedTextIssue = "missing" | "wrong-script" | "no-target-script" | "bad-text";

export function getLocalizedTextIssue(
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

export function assertValidLocalizedText(
    field: string,
    value: unknown,
    language: LocalizedLanguage,
): void {
    if (value === undefined || value === null) return;
    const issue = getLocalizedTextIssue(value, language);
    if (issue) {
        throw new Error(`Invalid ${language === "th" ? "Thai" : "Khmer"} text in ${field}: ${issue}`);
    }
}

export function assertRequiredLocalizedText(
    field: string,
    value: unknown,
    language: LocalizedLanguage,
): asserts value is string {
    const issue = getLocalizedTextIssue(value, language);
    if (issue) {
        throw new Error(`Invalid ${language === "th" ? "Thai" : "Khmer"} text in ${field}: ${issue}`);
    }
}

export function assertValidLocalizedArray(
    field: string,
    values: unknown,
    language: LocalizedLanguage,
): void {
    if (values === undefined || values === null) return;
    if (!Array.isArray(values)) throw new Error(`Invalid localized array in ${field}`);
    values.forEach((value, index) => assertValidLocalizedText(`${field}[${index}]`, value, language));
}
