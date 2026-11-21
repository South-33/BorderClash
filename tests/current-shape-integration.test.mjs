import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cp, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { keyUpdateRecords } from "../research/lib/current-shape.mjs";

const repoRoot = resolve(".");
const validator = join(repoRoot, "research", "validate.mjs");
const generator = join(repoRoot, "scripts", "generate-public.mjs");

function runNode(script, cwd) {
  return spawnSync(process.execPath, [script], {
    cwd,
    encoding: "utf8",
    windowsHide: true,
    maxBuffer: 64 * 1024 * 1024,
  });
}

async function writeJson(path, value) {
  await writeFile(path, JSON.stringify(value, null, 2) + "\n", "utf8");
}

test("evidence-linked current records validate while exporting the exact legacy UI fields", async () => {
  const root = await mkdtemp(join(tmpdir(), "borderclash-current-shape-"));
  try {
    await cp(join(repoRoot, "data"), join(root, "data"), { recursive: true });
    const newsFile = (await readdir(join(root, "data", "news"))).filter((name) => name.endsWith(".jsonl")).sort()[0];
    const firstArticle = JSON.parse(
      (await readFile(join(root, "data", "news", newsFile), "utf8")).split(/\r?\n/u).find(Boolean),
    );
    const evidenceId = firstArticle.id;

    const summaryPath = join(root, "data", "current", "summary.json");
    const summary = JSON.parse(await readFile(summaryPath, "utf8"));
    const normalizedUpdates = keyUpdateRecords(summary);
    const expectedUpdates = normalizedUpdates.map(({ text }) => text);
    const expectedTh = normalizedUpdates.map(({ textTh }) => textTh);
    const expectedKh = normalizedUpdates.map(({ textKh }) => textKh);
    summary.summaryEvidenceIds = [evidenceId];
    summary.keyUpdates = normalizedUpdates.map(({ text, textTh, textKh }) => ({
      text,
      textTh,
      textKh,
      evidenceIds: [evidenceId],
    }));
    delete summary.keyUpdatesTh;
    delete summary.keyUpdatesKh;
    await writeJson(summaryPath, summary);

    for (const name of ["thailand", "cambodia"]) {
      const path = join(root, "data", "current", name + ".json");
      const perspective = JSON.parse(await readFile(path, "utf8"));
      perspective.summaryEvidenceIds = [evidenceId];
      perspective.activityEvidenceIds = [evidenceId];
      await writeJson(path, perspective);
    }

    const impactPath = join(root, "data", "current", "impact.json");
    const impact = JSON.parse(await readFile(impactPath, "utf8"));
    for (const metric of Object.values({ displaced: impact.displaced, deaths: impact.deaths })) {
      metric.evidenceIds = [evidenceId];
      metric.scope = "Fixture population scope retained internally for evidence review";
    }
    await writeJson(impactPath, impact);

    const validated = runNode(validator, root);
    assert.equal(validated.status, 0, validated.stderr || validated.stdout);
    const generated = runNode(generator, root);
    assert.equal(generated.status, 0, generated.stderr || generated.stdout);

    const dashboard = JSON.parse(await readFile(join(root, "public", "data", "dashboard.json"), "utf8"));
    assert.deepEqual(dashboard.summary.keyUpdates, expectedUpdates);
    assert.deepEqual(dashboard.summary.keyUpdatesTh, expectedTh);
    assert.deepEqual(dashboard.summary.keyUpdatesKh, expectedKh);
    assert.equal(Object.hasOwn(dashboard.summary, "summaryEvidenceIds"), false);
    assert.equal(JSON.stringify(dashboard).includes("activityEvidenceIds"), false);

    summary.summary = "Talks are set for 2026-11-24.";
    summary.summaryTh = "การเจรจากำหนดไว้วันที่ 24 พฤศจิกายน 2026";
    summary.summaryKh = "កិច្ចពិភាក្សាត្រូវបានកំណត់សម្រាប់ថ្ងៃទី 24 ខែវិច្ឆិកា ឆ្នាំ 2026";
    await writeJson(summaryPath, summary);
    const warned = runNode(validator, root);
    assert.equal(warned.status, 0, warned.stderr || warned.stdout);
    assert.match(warned.stdout, /possible-lost-number-11/u);

    summary.keyUpdates[0].evidenceIds = ["missing-evidence-id"];
    await writeJson(summaryPath, summary);
    const rejected = runNode(validator, root);
    assert.notEqual(rejected.status, 0);
    assert.match(rejected.stderr + rejected.stdout, /unknown evidence id/u);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
