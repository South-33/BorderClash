import assert from "node:assert/strict";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { EVIDENCE_ALLOWED_SCORES, EVIDENCE_RUBRIC_VERSION } from "../research/lib/evidence-score.mjs";
import { normalizeArticleUrl } from "../research/lib/articles.mjs";

const command = process.argv[2];
const root = resolve();
const dataRoot = join(root, "data");
const snapshotPath = join(root, ".work", "evidence-v2-baseline.json");

function parseJsonl(text, file) {
  return text.split(/\r?\n/u).filter(Boolean).map((line, index) => {
    try {
      return JSON.parse(line);
    } catch (error) {
      throw new Error(`${file}:${index + 1}: invalid JSON: ${error.message}`);
    }
  });
}

function withoutKeys(value, keys) {
  if (Array.isArray(value)) return value.map((item) => withoutKeys(item, keys));
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value)
    .filter(([key]) => !keys.has(key))
    .map(([key, child]) => [key, withoutKeys(child, keys)]));
}

function omitObjectKeys(value, keys) {
  return Object.fromEntries(Object.entries(value).filter(([key]) => !keys.has(key)));
}

async function jsonlFiles(directory) {
  return (await readdir(directory)).filter((name) => name.endsWith(".jsonl")).sort();
}

async function readNews() {
  const rows = [];
  for (const name of await jsonlFiles(join(dataRoot, "news"))) {
    const file = `data/news/${name}`;
    for (const row of parseJsonl(await readFile(join(dataRoot, "news", name), "utf8"), file)) {
      rows.push({ ...row, __file: file });
    }
  }
  return rows;
}

async function readTimeline() {
  const rows = [];
  for (const name of await jsonlFiles(join(dataRoot, "timeline"))) {
    const file = `data/timeline/${name}`;
    for (const row of parseJsonl(await readFile(join(dataRoot, "timeline", name), "utf8"), file)) {
      rows.push({ ...row, __file: file });
    }
  }
  return rows;
}

function distribution(rows) {
  const out = {};
  for (const { credibility } of rows) out[credibility] = (out[credibility] || 0) + 1;
  return Object.fromEntries(Object.entries(out).sort((a, b) => Number(a[0]) - Number(b[0])));
}

async function collectBaseline() {
  const news = await readNews();
  const timeline = await readTimeline();
  const newsByUrl = new Map();
  for (const article of news) {
    const url = normalizeArticleUrl(article.sourceUrl);
    if (!url) continue;
    if (!newsByUrl.has(url)) newsByUrl.set(url, []);
    newsByUrl.get(url).push(article);
  }

  const universe = new Set(newsByUrl.keys());
  const timelineEvidence = {};
  const timelineContent = {};
  for (const event of timeline) {
    const urls = (event.sources || []).map((source) => normalizeArticleUrl(source.url)).filter(Boolean);
    timelineEvidence[event.id] = urls;
    for (const url of urls) universe.add(url);
    const { __file, ...clean } = event;
    timelineContent[event.id] = {
      file: __file,
      content: withoutKeys(clean, new Set(["sources", "evidenceIds"])),
    };
  }

  const uniqueNews = {};
  const duplicateNews = {};
  for (const [url, rows] of newsByUrl) {
    const cleaned = rows.map((article) => ({
      file: article.__file,
      row: omitObjectKeys(article, new Set(["__file", "credibility"])),
    }));
    if (rows.length === 1) uniqueNews[url] = cleaned[0];
    else duplicateNews[url] = cleaned;
  }

  const state = JSON.parse(await readFile(join(dataRoot, "research-state.json"), "utf8"));
  const stateWithoutActivation = omitObjectKeys(state, new Set(["evidenceRubricActivatedAt"]));

  return {
    stateWithoutActivation,
    uniqueArticleUrls: [...universe].sort(),
    uniqueNews,
    duplicateNews,
    timelineEvidence,
    timelineContent,
    stats: {
      newsRows: news.length,
      newsUniqueUrls: newsByUrl.size,
      duplicateUrlGroups: Object.keys(duplicateNews).length,
      timelineSourceRefs: Object.values(timelineEvidence).reduce((sum, urls) => sum + urls.length, 0),
      combinedUniqueArticles: universe.size,
      timelineOnlyArticles: [...universe].filter((url) => !newsByUrl.has(url)).length,
    },
  };
}

async function collectMigrated() {
  const news = await readNews();
  const timeline = await readTimeline();
  const byId = new Map();
  const byUrl = new Map();
  for (const article of news) {
    assert.ok(article.id, `${article.__file}: article missing id`);
    assert.ok(!byId.has(article.id), `${article.__file}: duplicate article id ${article.id}`);
    byId.set(article.id, article);
    const url = normalizeArticleUrl(article.sourceUrl);
    assert.ok(url, `${article.__file}:${article.id}: article missing sourceUrl`);
    assert.ok(!byUrl.has(url), `${article.__file}:${article.id}: duplicate canonical article URL`);
    byUrl.set(url, article);
  }

  const timelineEvidence = {};
  const timelineContent = {};
  for (const event of timeline) {
    assert.equal(event.sources, undefined, `${event.__file}:${event.id}: legacy inline sources remain`);
    assert.ok(Array.isArray(event.evidenceIds) && event.evidenceIds.length > 0, `${event.__file}:${event.id}: missing evidenceIds`);
    const ids = new Set();
    const urls = [];
    for (const id of event.evidenceIds) {
      assert.ok(!ids.has(id), `${event.__file}:${event.id}: duplicate evidence id ${id}`);
      ids.add(id);
      const article = byId.get(id);
      assert.ok(article, `${event.__file}:${event.id}: unknown evidence id ${id}`);
      urls.push(normalizeArticleUrl(article.sourceUrl));
    }
    timelineEvidence[event.id] = urls;
    const { __file, ...clean } = event;
    timelineContent[event.id] = {
      file: __file,
      content: withoutKeys(clean, new Set(["sources", "evidenceIds"])),
    };
  }
  return { news, timelineEvidence, timelineContent, byUrl };
}

async function snapshot() {
  const baseline = await collectBaseline();
  await mkdir(join(root, ".work"), { recursive: true });
  await writeFile(snapshotPath, JSON.stringify({
    createdAt: Date.now(),
    rubric: EVIDENCE_RUBRIC_VERSION,
    ...baseline,
  }, null, 2) + "\n", "utf8");
  console.log(JSON.stringify({ ok: true, snapshotPath, ...baseline.stats }, null, 2));
}

async function verify() {
  const baseline = JSON.parse(await readFile(snapshotPath, "utf8"));
  const current = await collectMigrated();
  assert.equal(EVIDENCE_RUBRIC_VERSION, "evidence-v2", "migration harness requires evidence-v2");

  const currentUrls = [...current.byUrl.keys()].sort();
  assert.deepEqual(currentUrls, baseline.uniqueArticleUrls, "canonical article URL universe changed");
  assert.equal(current.news.length, baseline.uniqueArticleUrls.length, "one canonical row per article URL is required");

  for (const [url, before] of Object.entries(baseline.uniqueNews)) {
    const after = current.byUrl.get(url);
    assert.ok(after, `existing article disappeared: ${url}`);
    const afterWithoutScore = omitObjectKeys(after, new Set(["__file", "credibility"]));
    assert.deepEqual(afterWithoutScore, before.row, `non-score fields changed for unique article ${url}`);
  }

  for (const [url, beforeRows] of Object.entries(baseline.duplicateNews)) {
    const after = current.byUrl.get(url);
    assert.ok(after, `duplicate article group disappeared: ${url}`);
    assert.ok(beforeRows.some(({ row }) => row.id === after.id), `duplicate article ${url} must retain one existing id`);
  }

  assert.deepEqual(Object.keys(current.timelineContent).sort(), Object.keys(baseline.timelineContent).sort(), "timeline event set changed");
  for (const [id, before] of Object.entries(baseline.timelineContent)) {
    const after = current.timelineContent[id];
    assert.equal(after.file, before.file, `${id}: timeline event moved files`);
    assert.deepEqual(after.content, before.content, `${id}: timeline content changed beyond evidence references`);
    assert.deepEqual(current.timelineEvidence[id], baseline.timelineEvidence[id], `${id}: timeline evidence URLs changed or reordered`);
  }

  for (const article of current.news) {
    assert.ok(EVIDENCE_ALLOWED_SCORES.has(article.credibility), `${article.id}: score ${article.credibility} is not an evidence-v2 decile`);
    if (article.status === "unverified") assert.ok(article.credibility <= 50, `${article.id}: unverified article cannot exceed 50`);
  }

  const state = JSON.parse(await readFile(join(dataRoot, "research-state.json"), "utf8"));
  const { evidenceRubricActivatedAt, ...stateWithoutActivation } = state;
  assert.deepEqual(stateWithoutActivation, baseline.stateWithoutActivation, "research-state changed beyond evidenceRubricActivatedAt");
  assert.equal(state.evidenceRubricVersion, "evidence-v2", "research-state must use evidence-v2");
  assert.ok(Number.isFinite(evidenceRubricActivatedAt), "evidenceRubricActivatedAt must be numeric");

  console.log(JSON.stringify({
    ok: true,
    canonicalArticles: current.news.length,
    timelineEvents: Object.keys(current.timelineContent).length,
    distribution: distribution(current.news),
    score100: current.news.filter((row) => row.credibility === 100).length,
    score0or10: current.news.filter((row) => row.credibility <= 10).length,
  }, null, 2));
}

if (command === "snapshot") await snapshot();
else if (command === "verify") await verify();
else throw new Error("Usage: node scripts/evidence-migration-harness.mjs <snapshot|verify>");
