const CANONICAL_DATA_PATHS = [
  /^research-state\.json$/u,
  /^current\/(?:impact|thailand|cambodia|summary)\.json$/u,
  /^news\/\d{4}-\d{2}\.jsonl$/u,
  /^timeline\/\d{4}-\d{2}\.jsonl$/u,
];

export function isCanonicalDataPath(path) {
  const normalized = String(path).replaceAll("\\", "/").replace(/^\.\//u, "");
  return CANONICAL_DATA_PATHS.some((pattern) => pattern.test(normalized));
}

