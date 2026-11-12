import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { EVIDENCE_ALLOWED_SCORES, EVIDENCE_RUBRIC_VERSION } from "../research/lib/evidence-score.mjs";

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

function withoutCredibility(value) {
  if (Array.isArray(value)) return value.map(withoutCredibility);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value)
    .filter(([key]) => key !== "credibility")
    .map(([key, child]) => [key, withoutCredibility(child)]));
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
}

function digest(value) {
  return createHash("sha256").update(JSON.stringify(stable(value))).digest("hex");
}

async function jsonlFiles(directory) {
  return (await readdir(directory)).filter((name) => name.endsWith(".jsonl")).sort();
}

async function collect() {
  const files = {};
  const scores = [];

  for (const kind of ["news", "timeline"]) {
    const directory = join(dataRoot, kind);
    for (const name of await jsonlFiles(directory)) {
      const relative = `data/${kind}/${name}`;
      const records = parseJsonl(await readFile(join(directory, name), "utf8"), relative);
      const sanitized = withoutCredibility(records);
      files[relative] = {
        count: records.length,
        semanticHashWithoutCredibility: digest(sanitized),
        sanitized,
      };

      for (const [recordIndex, record] of records.entries()) {
        if (kind === "news") {
          scores.push({
            key: `${relative}:${record.id || recordIndex}`,
            kind,
            status: record.status || "",
            score: record.credibility,
          });
          continue;
        }
        for (const [sourceIndex, source] of (record.sources || []).entries()) {
          scores.push({
            key: `${relative}:${record.id || recordIndex}:source:${sourceIndex}`,
            kind: "timeline-source",
            status: record.status || "",
            score: source.credibility,
          });
        }
      }
    }
  }

  const state = JSON.parse(await readFile(join(dataRoot, "research-state.json"), "utf8"));
  const { evidenceRubricActivatedAt: _ignored, ...stateWithoutActivation } = state;
  return { files, scores, stateWithoutActivation };
}

function distribution(scores) {
  const out = {};
  for (const { score } of scores) out[score] = (out[score] || 0) + 1;
  return Object.fromEntries(Object.entries(out).sort((a, b) => Number(a[0]) - Number(b[0])));
}

async function snapshot() {
  const baseline = await collect();
  await mkdir(join(root, ".work"), { recursive: true });
  await writeFile(snapshotPath, JSON.stringify({
    createdAt: Date.now(),
    rubric: EVIDENCE_RUBRIC_VERSION,
    ...baseline,
  }, null, 2) + "\n", "utf8");
  console.log(JSON.stringify({
    ok: true,
    snapshotPath,
    scoreInstances: baseline.scores.length,
    distribution: distribution(baseline.scores),
  }, null, 2));
}

async function verify() {
  const baseline = JSON.parse(await readFile(snapshotPath, "utf8"));
  const current = await collect();

  assert.equal(EVIDENCE_RUBRIC_VERSION, "evidence-v2", "migration harness requires evidence-v2");
  assert.deepEqual(Object.keys(current.files), Object.keys(baseline.files), "news/timeline file set changed");
  for (const [file, before] of Object.entries(baseline.files)) {
    const after = current.files[file];
    assert.equal(after.count, before.count, `${file}: record count changed`);
    assert.equal(after.semanticHashWithoutCredibility, before.semanticHashWithoutCredibility, `${file}: fields other than credibility changed`);
    assert.deepEqual(after.sanitized, before.sanitized, `${file}: semantic content other than credibility changed`);
  }
  assert.deepEqual(current.stateWithoutActivation, baseline.stateWithoutActivation, "research-state changed beyond evidenceRubricActivatedAt");
  assert.equal(current.scores.length, baseline.scores.length, "score instance count changed");

  const beforeByKey = new Map(baseline.scores.map((row) => [row.key, row]));
  const changes = [];
  for (const row of current.scores) {
    assert.ok(EVIDENCE_ALLOWED_SCORES.has(row.score), `${row.key}: score ${row.score} is not an evidence-v2 decile`);
    if (row.kind === "news" && row.status === "unverified") {
      assert.ok(row.score <= 50, `${row.key}: unverified news cannot exceed 50`);
    }
    const before = beforeByKey.get(row.key);
    assert.ok(before, `${row.key}: score key did not exist in baseline`);
    if (before.score !== row.score) changes.push({ key: row.key, from: before.score, to: row.score });
  }

  const state = JSON.parse(await readFile(join(dataRoot, "research-state.json"), "utf8"));
  assert.equal(state.evidenceRubricVersion, "evidence-v2", "research-state must use evidence-v2");
  assert.ok(Number.isFinite(state.evidenceRubricActivatedAt), "evidenceRubricActivatedAt must be numeric");

  const highRisk = current.scores.filter((row) => row.score === 100 || row.score <= 10);
  console.log(JSON.stringify({
    ok: true,
    scoreInstances: current.scores.length,
    changedScores: changes.length,
    unchangedScores: current.scores.length - changes.length,
    distribution: distribution(current.scores),
    score100: current.scores.filter((row) => row.score === 100).length,
    score0or10: highRisk.length,
    sampleChanges: changes.slice(0, 25),
  }, null, 2));
}

if (command === "snapshot") await snapshot();
else if (command === "verify") await verify();
else throw new Error("Usage: node scripts/evidence-migration-harness.mjs <snapshot|verify>");
