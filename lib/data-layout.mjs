const CANONICAL_DATA_PATHS = [
  /^state\.json$/u,
  /^dashboard\.json$/u,
  /^analysis\/(?:thailand|cambodia|neutral)\.json$/u,
  /^news\/\d{4}-\d{2}\/(?:thailand|cambodia|international)\.jsonl$/u,
  /^timeline\/\d{4}-\d{2}\.jsonl$/u,
];

export function isCanonicalDataPath(path) {
  const normalized = String(path).replaceAll("\\", "/").replace(/^\.\//u, "");
  return CANONICAL_DATA_PATHS.some((pattern) => pattern.test(normalized));
}

