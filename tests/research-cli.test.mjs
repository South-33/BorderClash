import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";

const script = resolve("research", "cli.mjs");

async function writeJsonFile(path, value) {
  await mkdir(resolve(path, ".."), { recursive: true });
  await writeFile(path, JSON.stringify(value, null, 2) + "\n");
}

async function writeJsonlFile(path, rows) {
  await mkdir(resolve(path, ".."), { recursive: true });
  await writeFile(path, rows.map((row) => JSON.stringify(row)).join("\n") + "\n");
}

function localizedNews(id, title, publishedAt, fetchedAt = publishedAt, status = "active") {
  return {
    id,
    status,
    source: "Fixture",
    category: "military",
    title,
    titleEn: title,
    titleTh: "ข่าวชายแดน",
    titleKh: "ព័ត៌មានព្រំដែន",
    publishedAt,
    fetchedAt,
  };
}

async function makeBriefFixture({ lastResearchAt, lastCycleInterval = 24, news, timeline }) {
  const root = await mkdtemp(join(tmpdir(), "borderclash-brief-"));
  await writeJsonFile(join(root, "data", "research-state.json"), {
    schemaVersion: 1,
    isPaused: false,
    systemStatus: "online",
    lastResearchAt,
    nextRunAt: lastResearchAt + 24 * 3_600_000,
    lastCycleInterval,
    schedulingReason: "fixture",
    researchCycleCount: 1,
    scheduler: "external",
  });
  await writeJsonFile(join(root, "data", "current", "impact.json"), {
    displaced: { value: 0, qualifier: "MORE_THAN" },
    deaths: { value: 0, qualifier: "AT_LEAST" },
    updatedAt: lastResearchAt,
  });
  for (const name of ["thailand", "cambodia"]) {
    await writeJsonFile(join(root, "data", "current", `${name}.json`), {
      updatedAt: lastResearchAt,
      activityLabel: "No new armed clash reported",
      summary: "Border situation remains calm.",
    });
  }
  await writeJsonFile(join(root, "data", "current", "summary.json"), {
    updatedAt: lastResearchAt,
    summary: "Border situation remains calm.",
    keyUpdates: [],
  });
  await writeJsonlFile(
    join(root, "data", "news", "2026-11.jsonl"),
    [
      ...(news.thailand || []).map((row) => ({ ...row, mediaEnvironment: "thailand-domestic" })),
      ...(news.cambodia || []).map((row) => ({ ...row, mediaEnvironment: "cambodia-domestic" })),
      ...(news.international || []).map((row) => ({ ...row, mediaEnvironment: "international" })),
    ],
  );
  await writeJsonlFile(join(root, "data", "timeline", "2026.jsonl"), timeline);
  return root;
}

function runBrief(root, nowMs) {
  const result = spawnSync(process.execPath, [script, "brief"], {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, BORDERCLASH_NOW_MS: String(nowMs) },
  });
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout);
}

test("brief always gives at least seven days of compact local context", async () => {
  const now = Date.parse("2026-11-10T12:00:00Z");
  const lastResearchAt = Date.parse("2026-11-08T12:00:00Z");
  const old = Date.parse("2026-11-06T12:00:00Z");
  const root = await makeBriefFixture({
    lastResearchAt,
    news: {
      thailand: [localizedNews("th-old", "Thailand border talks continue", old)],
      cambodia: [localizedNews("kh-old", "Cambodia reports border monitoring", old)],
      international: [
        localizedNews("intl-noise", "Singapore sand imports affect fishing community", old + 1_000, old + 1_000, "archived"),
        localizedNews("intl-old", "ASEAN border observers continue monitoring", old),
      ],
    },
    timeline: [
      { id: "tl-1", date: "2026-11-05", timeOfDay: "12:00", title: "Border monitoring continues" },
      { id: "tl-2", date: "2026-11-04", timeOfDay: "12:00", title: "Ceasefire review held" },
      { id: "tl-3", date: "2026-11-03", timeOfDay: "12:00", title: "Older event" },
    ],
  });
  try {
    const brief = runBrief(root, now);
    assert.equal(brief.contextWindow.start, "2026-11-03T12:00:00.000Z");
    assert.equal(brief.contextWindow.end, "2026-11-10T12:00:00.000Z");
    assert.equal(brief.contextWindow.lookbackDays, 7);
    assert.equal(brief.contextWindow.cappedAt30Days, false);
    assert.deepEqual(brief.contextWindow.counts, {
      timeline: 3,
      news: { thailand: 1, cambodia: 1, international: 1 },
    });
    assert.deepEqual(brief.contextWindow.sinceLastCycleCounts, {
      timeline: 0,
      news: { thailand: 0, cambodia: 0, international: 0 },
    });
    assert.equal(brief.recentTimeline.length, 3);
    assert.equal(brief.recentNews.thailand.length, 1);
    assert.equal(brief.recentNews.cambodia.length, 1);
    assert.equal(brief.recentNews.international.length, 1);
    assert.equal(brief.recentNews.international[0].id, "intl-old");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("brief surfaces fresh material context and counts newly fetched older reporting", async () => {
  const now = Date.parse("2026-11-10T12:00:00Z");
  const lastResearchAt = Date.parse("2026-11-08T12:00:00Z");
  const recent = Date.parse("2026-11-08T14:00:00Z");
  const old = Date.parse("2026-11-01T12:00:00Z");
  const root = await makeBriefFixture({
    lastResearchAt,
    lastCycleInterval: 4,
    news: {
      thailand: [
        localizedNews("th-1", "Thailand border troops hold position", recent + 3_000),
        localizedNews("th-2", "Thailand border talks continue", recent + 2_000),
        localizedNews("th-fetched", "Older border report newly discovered", old, recent + 1_000),
        localizedNews("th-local", "กองทัพไทยยังคงเฝ้าระวังพื้นที่ชายแดน", recent + 500),
      ],
      cambodia: [localizedNews("kh-1", "Cambodia border monitoring continues", recent)],
      international: [
        localizedNews("intl-noise", "Singapore sand imports affect fishing community", recent + 1_000),
        localizedNews("intl-1", "ASEAN border observers inspect ceasefire area", recent),
      ],
    },
    timeline: Array.from({ length: 5 }, (_, index) => ({
      id: `tl-${index + 1}`,
      date: "2026-11-08",
      timeOfDay: `1${index}:00`,
      createdAt: recent + index,
      title: `Border event ${index + 1}`,
    })),
  });
  try {
    const brief = runBrief(root, now);
    assert.equal(brief.contextWindow.start, "2026-11-03T12:00:00.000Z");
    assert.deepEqual(brief.contextWindow.counts, {
      timeline: 5,
      news: { thailand: 4, cambodia: 1, international: 2 },
    });
    assert.deepEqual(brief.contextWindow.sinceLastCycleCounts, {
      timeline: 5,
      news: { thailand: 4, cambodia: 1, international: 2 },
    });
    assert.equal(brief.recentTimeline.length, 5);
    assert.deepEqual(
      brief.recentNews.thailand.map((row) => row.id),
      ["th-1", "th-2", "th-local", "th-fetched"],
    );
    assert.deepEqual(brief.recentNews.international.map((row) => row.id), ["intl-noise", "intl-1"]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("brief extends to the previous cycle but caps automatic context at thirty days", async () => {
  const now = Date.parse("2026-11-10T12:00:00Z");
  const lastResearchAt = now - 45 * 24 * 3_600_000;
  const root = await makeBriefFixture({
    lastResearchAt,
    news: { thailand: [], cambodia: [], international: [] },
    timeline: [],
  });
  try {
    const brief = runBrief(root, now);
    assert.equal(brief.contextWindow.start, "2026-10-11T12:00:00.000Z");
    assert.equal(brief.contextWindow.lookbackDays, 30);
    assert.equal(brief.contextWindow.cappedAt30Days, true);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("finish records completion intent without mutating trusted scheduler state", async () => {
  const root = await mkdtemp(join(tmpdir(), "borderclash-research-cli-"));
  try {
    await mkdir(join(root, "data"), { recursive: true });
    const originalState = {
      schemaVersion: 1,
      isPaused: true,
      systemStatus: "online",
      lastResearchAt: 1,
      nextRunAt: 2,
      lastCycleInterval: 24,
      schedulingReason: "old",
      researchCycleCount: 7,
      scheduler: "external",
    };
    await writeFile(join(root, "data", "research-state.json"), JSON.stringify(originalState, null, 2) + "\n");
    await mkdir(join(root, ".work"), { recursive: true });
    await writeFile(join(root, ".work", "CYCLE_RUN.json"), JSON.stringify({ runId: "cycle-test-1" }) + "\n");

    const result = spawnSync(process.execPath, [
      script,
      "finish",
      "18",
      "Stable conditions with no fast-moving material change.",
    ], { cwd: root, encoding: "utf8" });

    assert.equal(result.status, 0, result.stderr);
    const state = JSON.parse(await readFile(join(root, "data", "research-state.json"), "utf8"));
    assert.deepEqual(state, originalState);
    const marker = JSON.parse(await readFile(join(root, ".work", "research-finish.json"), "utf8"));
    assert.equal(marker.cycleId, "cycle-test-1");
    assert.equal(marker.decision, "complete");
    assert.equal(marker.intervalHours, 18);
    assert.match(marker.reason, /Stable conditions/u);
    assert.ok(Number.isFinite(marker.requestedAt));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("finish requires an explicit cadence and reason even when cadence stays the same", async () => {
  const root = await mkdtemp(join(tmpdir(), "borderclash-research-cli-"));
  try {
    await mkdir(join(root, "data"), { recursive: true });
    await writeFile(join(root, "data", "research-state.json"), JSON.stringify({
      schemaVersion: 1,
      isPaused: false,
      lastResearchAt: 1,
      nextRunAt: 2,
      lastCycleInterval: 24,
      schedulingReason: "Quiet conditions; daily review remains appropriate.",
      researchCycleCount: 7,
      scheduler: "external",
    }, null, 2) + "\n");
    await mkdir(join(root, ".work"), { recursive: true });
    await writeFile(join(root, ".work", "CYCLE_RUN.json"), JSON.stringify({ runId: "cycle-test-2" }) + "\n");

    const missing = spawnSync(process.execPath, [script, "finish"], { cwd: root, encoding: "utf8" });
    assert.notEqual(missing.status, 0);
    assert.match(missing.stderr, /explicit cadence and reason/u);
    const result = spawnSync(process.execPath, [
      script,
      "finish",
      "24",
      "Quiet conditions still justify a daily review.",
    ], { cwd: root, encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);
    const state = JSON.parse(await readFile(join(root, "data", "research-state.json"), "utf8"));
    assert.equal(state.researchCycleCount, 7);
    assert.equal(state.lastCycleInterval, 24);
    assert.equal(state.schedulingReason, "Quiet conditions; daily review remains appropriate.");
    const marker = JSON.parse(await readFile(join(root, ".work", "research-finish.json"), "utf8"));
    assert.equal(marker.intervalHours, 24);
    assert.equal(marker.reason, "Quiet conditions still justify a daily review.");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("finish is idempotent within one runner cycle", async () => {
  const root = await mkdtemp(join(tmpdir(), "borderclash-research-cli-"));
  try {
    await mkdir(join(root, "data"), { recursive: true });
    await writeFile(join(root, "data", "research-state.json"), JSON.stringify({
      schemaVersion: 1,
      isPaused: false,
      lastResearchAt: 1,
      nextRunAt: 2,
      lastCycleInterval: 24,
      schedulingReason: "Quiet conditions.",
      researchCycleCount: 7,
      scheduler: "external",
    }, null, 2) + "\n");

    await mkdir(join(root, ".work"), { recursive: true });
    await writeFile(join(root, ".work", "CYCLE_RUN.json"), JSON.stringify({ runId: "cycle-test-1" }) + "\n");
    const first = spawnSync(process.execPath, [script, "finish", "24", "Quiet conditions still justify a daily review."], {
      cwd: root,
      encoding: "utf8",
    });
    assert.equal(first.status, 0, first.stderr);
    const afterFirst = JSON.parse(await readFile(join(root, ".work", "research-finish.json"), "utf8"));

    const second = spawnSync(process.execPath, [script, "finish", "12", "This second call must not advance the cycle."], {
      cwd: root,
      encoding: "utf8",
    });
    assert.equal(second.status, 0, second.stderr);
    assert.equal(JSON.parse(second.stdout).alreadyFinished, true);
    const afterSecond = JSON.parse(await readFile(join(root, ".work", "research-finish.json"), "utf8"));
    assert.deepEqual(afterSecond, afterFirst);
    const state = JSON.parse(await readFile(join(root, "data", "research-state.json"), "utf8"));
    assert.equal(state.researchCycleCount, 7);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("finish requires a reason for every cadence and rejects scheduling beyond one week", async () => {
  const root = await mkdtemp(join(tmpdir(), "borderclash-research-cli-"));
  try {
    await mkdir(join(root, "data"), { recursive: true });
    await writeFile(join(root, "data", "research-state.json"), JSON.stringify({
      researchCycleCount: 3,
      lastCycleInterval: 24,
      schedulingReason: "fixture",
    }) + "\n");
    await mkdir(join(root, ".work"), { recursive: true });
    await writeFile(join(root, ".work", "CYCLE_RUN.json"), JSON.stringify({ runId: "cycle-test-3" }) + "\n");

    const missingReason = spawnSync(process.execPath, [script, "finish", "80"], { cwd: root, encoding: "utf8" });
    assert.notEqual(missingReason.status, 0);
    assert.match(missingReason.stderr, /reason is required/u);

    const unchangedMissingReason = spawnSync(process.execPath, [script, "finish", "24"], { cwd: root, encoding: "utf8" });
    assert.notEqual(unchangedMissingReason.status, 0);
    assert.match(unchangedMissingReason.stderr, /reason is required/u);

    const result = spawnSync(process.execPath, [
      script,
      "finish",
      "169",
      "Too far away.",
    ], { cwd: root, encoding: "utf8" });

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /between 1 and 168/u);

    const accepted = spawnSync(process.execPath, [
      script,
      "finish",
      "80",
      "Conditions are quiet and no near-term trigger is visible.",
    ], { cwd: root, encoding: "utf8" });
    assert.equal(accepted.status, 0, accepted.stderr);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("finish can request durable operator review without changing scheduler state", async () => {
  const root = await mkdtemp(join(tmpdir(), "borderclash-research-cli-"));
  try {
    await mkdir(join(root, "data"), { recursive: true });
    await writeFile(join(root, "data", "research-state.json"), JSON.stringify({
      lastCycleInterval: 24,
      schedulingReason: "fixture",
      researchCycleCount: 3,
    }) + "\n");
    await mkdir(join(root, ".work"), { recursive: true });
    await writeFile(join(root, ".work", "CYCLE_RUN.json"), JSON.stringify({ runId: "cycle-review-1" }) + "\n");

    const result = spawnSync(process.execPath, [
      script,
      "finish",
      "--review",
      "The cited source is unavailable and the event date cannot be verified.",
    ], { cwd: root, encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);
    const marker = JSON.parse(await readFile(join(root, ".work", "research-finish.json"), "utf8"));
    assert.equal(marker.decision, "review");
    assert.match(marker.reason, /event date cannot be verified/u);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("a resumed reviewed cycle can replace review intent with completion intent", async () => {
  const root = await mkdtemp(join(tmpdir(), "borderclash-research-cli-"));
  try {
    await mkdir(join(root, "data"), { recursive: true });
    await writeFile(join(root, "data", "research-state.json"), JSON.stringify({
      lastCycleInterval: 24,
      schedulingReason: "fixture cadence",
      researchCycleCount: 3,
    }) + "\n");
    await mkdir(join(root, ".work"), { recursive: true });
    await writeFile(join(root, ".work", "CYCLE_RUN.json"), JSON.stringify({ runId: "cycle-review-resume-1" }) + "\n");

    const review = spawnSync(process.execPath, [
      script,
      "finish",
      "--review",
      "Needs operator review first.",
    ], { cwd: root, encoding: "utf8" });
    assert.equal(review.status, 0, review.stderr);

    const complete = spawnSync(process.execPath, [
      script,
      "finish",
      "12",
      "Operator resolved the blocker; closer follow-up is appropriate.",
    ], { cwd: root, encoding: "utf8" });
    assert.equal(complete.status, 0, complete.stderr);
    const marker = JSON.parse(await readFile(join(root, ".work", "research-finish.json"), "utf8"));
    assert.equal(marker.decision, "complete");
    assert.equal(marker.intervalHours, 12);
    assert.match(marker.reason, /Operator resolved/u);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("capture-changed exits 3 when a manual publisher alias needs identity review", async () => {
  const root = await mkdtemp(join(tmpdir(), "borderclash-capture-changed-"));
  try {
    const newsPath = join(root, "data", "news", "2026-11.jsonl");
    const existing = {
      id: "existing-freshnews-001",
      source: "Fresh News",
      sourceUrl: "https://freshnewsasia.com/localnews/412489-2025-12-18-11-52-51",
      title: "Existing article",
      fetchedAt: Date.UTC(2026, 10, 13),
    };
    await writeJsonlFile(newsPath, [existing]);
    for (const args of [
      ["init", "--quiet"],
      ["config", "user.name", "Fixture"],
      ["config", "user.email", "fixture@example.invalid"],
      ["add", "data/news/2026-11.jsonl"],
      ["commit", "--quiet", "-m", "fixture base"],
    ]) {
      const git = spawnSync("git", args, { cwd: root, encoding: "utf8" });
      assert.equal(git.status, 0, git.stderr);
    }
    const alias = {
      ...existing,
      id: "manual-alias-001",
      sourceUrl: "https://m.freshnewsasia.com/localnews/412489-2025-12-18-11-52-51",
      title: "Manual mobile alias",
    };
    await writeJsonlFile(newsPath, [existing, alias]);

    const result = spawnSync(process.execPath, [script, "capture-changed", "HEAD"], {
      cwd: root,
      encoding: "utf8",
    });
    assert.equal(result.status, 3, result.stderr);
    const output = JSON.parse(result.stdout);
    assert.equal(output.ok, false);
    assert.equal(output.identityConflicts, 1);
    assert.equal(output.results[0].articleId, alias.id);
    assert.equal(output.results[0].status, "identity-conflict");
    assert.deepEqual(output.results[0].existingIds, [existing.id]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("ingest --no-localize leaves unrelated localized news unchanged", async () => {
  const root = await mkdtemp(join(tmpdir(), "borderclash-ingest-no-localize-"));
  try {
    const existing = {
      id: "existing-evidence",
      source: "Fixture",
      sourceUrl: "http://127.0.0.1:1/existing",
      category: "diplomatic",
      mediaEnvironment: "international",
      status: "archived",
      title: "Existing evidence",
      summary: "Existing evidence summary.",
      credibility: 80,
      publishedAt: Date.UTC(2026, 10, 15),
      fetchedAt: Date.UTC(2026, 10, 15),
    };
    await writeJsonlFile(join(root, "data", "news", "2026-11.jsonl"), [existing]);

    const unrelatedPath = join(root, "data", "news", "2025-01.jsonl");
    await writeJsonlFile(unrelatedPath, [{
      id: "old-localized",
      source: "Fixture",
      sourceUrl: "https://example.invalid/old-localized",
      category: "humanitarian",
      mediaEnvironment: "thailand-domestic",
      status: "active",
      title: "Old localized report",
      titleTh: "ข่าวภาษาไทยที่ต้องคงเดิม",
      titleKh: "ព័ត៌មានភាសាខ្មែរដែលត្រូវរក្សាទុក",
      credibility: 70,
      publishedAt: Date.UTC(2025, 0, 1),
      fetchedAt: Date.UTC(2025, 0, 1),
    }]);
    const before = await readFile(unrelatedPath, "utf8");

    const candidatePath = join(root, "candidate.jsonl");
    const { id: _id, fetchedAt: _fetchedAt, ...candidate } = existing;
    await writeJsonlFile(candidatePath, [candidate]);

    const result = spawnSync(process.execPath, [script, "ingest", candidatePath, "--no-localize"], {
      cwd: root,
      encoding: "utf8",
      env: {
        ...process.env,
        BORDERCLASH_EVIDENCE_ARCHIVE: join(root, "archive"),
        BORDERCLASH_EVIDENCE_BACKUP: join(root, "archive-backup"),
      },
    });

    assert.equal(result.status, 0, result.stderr);
    const output = JSON.parse(result.stdout);
    assert.equal(output.ok, true);
    assert.equal(output.results[0].action, "existing");
    assert.deepEqual(output.localization, { skipped: true });
    assert.equal(await readFile(unrelatedPath, "utf8"), before);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("--help is a successful alias for help", () => {
  const result = spawnSync(process.execPath, [script, "--help"], {
    cwd: process.cwd(),
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /node research\/cli\.mjs \[context\]/u);
  assert.match(result.stdout, /--no-localize/u);
  assert.match(result.stdout, /node research\/cli\.mjs finish/u);
  assert.doesNotMatch(result.stdout, /research check/u);
});
