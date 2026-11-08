import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

const script = resolve("scripts", "research.mjs");

test("finish owns cycle timestamps and preserves pause state", async () => {
  const root = await mkdtemp(join(tmpdir(), "borderclash-research-cli-"));
  try {
    await mkdir(join(root, "data"), { recursive: true });
    await writeFile(join(root, "data", "state.json"), JSON.stringify({
      schemaVersion: 1,
      isPaused: true,
      systemStatus: "online",
      lastResearchAt: 1,
      nextRunAt: 2,
      lastCycleInterval: 24,
      schedulingReason: "old",
      researchCycleCount: 7,
      scheduler: "external",
    }, null, 2) + "\n");

    const before = Date.now();
    const result = spawnSync(process.execPath, [
      script,
      "finish",
      "18",
      "Stable conditions with no fast-moving material change.",
    ], { cwd: root, encoding: "utf8" });
    const after = Date.now();

    assert.equal(result.status, 0, result.stderr);
    const state = JSON.parse(await readFile(join(root, "data", "state.json"), "utf8"));
    assert.equal(state.isPaused, true);
    assert.equal(state.systemStatus, "online");
    assert.equal(state.scheduler, "external");
    assert.equal(state.researchCycleCount, 8);
    assert.equal(state.lastCycleInterval, 18);
    assert.match(state.schedulingReason, /Stable conditions/u);
    assert.ok(state.lastResearchAt >= before && state.lastResearchAt <= after);
    assert.equal(state.nextRunAt - state.lastResearchAt, 18 * 3_600_000);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("finish rejects scheduling outside 1..24 hours", async () => {
  const root = await mkdtemp(join(tmpdir(), "borderclash-research-cli-"));
  try {
    await mkdir(join(root, "data"), { recursive: true });
    await writeFile(join(root, "data", "state.json"), "{}\n");
    const result = spawnSync(process.execPath, [
      script,
      "finish",
      "25",
      "Too far away.",
    ], { cwd: root, encoding: "utf8" });

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /between 1 and 24/u);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
