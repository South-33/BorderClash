import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { cp, mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";

const repoRoot = resolve(".");

function git(cwd, args) {
  return execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
}

test("review scopes advisory diagnostics to timeline records changed since the cycle base", async () => {
  const root = await mkdtemp(join(tmpdir(), "borderclash-review-"));
  try {
    await Promise.all([
      cp(join(repoRoot, "data"), join(root, "data"), { recursive: true }),
      cp(join(repoRoot, "research"), join(root, "research"), { recursive: true }),
    ]);
    git(root, ["init", "--quiet"]);
    git(root, ["config", "user.name", "Test"]);
    git(root, ["config", "user.email", "test@example.invalid"]);
    git(root, ["add", "data"]);
    git(root, ["commit", "--quiet", "-m", "fixture"]);
    const baseHead = git(root, ["rev-parse", "HEAD"]);
    await mkdir(join(root, ".work"), { recursive: true });
    await writeFile(join(root, ".work", "CYCLE_RUN.json"), JSON.stringify({ runId: "test", baseHead }), "utf8");

    const timelinePath = join(root, "data", "timeline", "2026-11.jsonl");
    const lines = (await readFile(timelinePath, "utf8")).trim().split(/\r?\n/u);
    const first = JSON.parse(lines[0]);
    first.description = first.description + " ";
    lines[0] = JSON.stringify(first);
    await writeFile(timelinePath, lines.join("\n") + "\n", "utf8");

    const result = spawnSync(process.execPath, ["research/cli.mjs", "review"], {
      cwd: root,
      encoding: "utf8",
      maxBuffer: 16 * 1024 * 1024,
    });
    assert.equal(result.status, 0, result.stderr || result.stdout);
    const output = JSON.parse(result.stdout);
    assert.equal(output.readOnly, true);
    assert.ok(output.scope.changedPaths.includes("data/timeline/2026-11.jsonl"));
    assert.deepEqual(output.scope.changedTimelineIds, [first.id]);
    assert.deepEqual(output.scope.removedTimelineIds, []);
    assert.ok(output.objectiveChecks.some((value) => value.includes("script contamination")));
    assert.ok(output.objectiveChecks.some((value) => value.includes("numeric fidelity")));
    assert.ok(Array.isArray(output.advisories));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
