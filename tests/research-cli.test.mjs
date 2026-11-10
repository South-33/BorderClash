import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

const script = resolve("scripts", "research.mjs");

async function writeJsonFile(path, value) {
  await mkdir(resolve(path, ".."), { recursive: true });
  await writeFile(path, JSON.stringify(value, null, 2) + "\n");
}

async function writeJsonlFile(path, rows) {
  await mkdir(resolve(path, ".."), { recursive: true });
  await writeFile(path, rows.map((row) => JSON.stringify(row)).join("\n") + "\n");
}

function localizedNews(id, title, publishedAt, fetchedAt = publishedAt) {
  return {
    id,
    status: "active",
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
  await writeJsonFile(join(root, "data", "state.json"), {
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
  await writeJsonFile(join(root, "data", "dashboard.json"), {
    conflictLevel: "LOW",
    displacedCount: 0,
    casualtyCount: 0,
    civilianInjuredCount: 0,
    militaryInjuredCount: 0,
    lastUpdatedAt: lastResearchAt,
  });
  for (const name of ["thailand", "cambodia", "neutral"]) {
    await writeJsonFile(join(root, "data", "analysis", `${name}.json`), {
      lastUpdatedAt: lastResearchAt,
      conflictLevel: "Low",
      militaryIntensity: 10,
      militaryPosture: "DEFENSIVE",
      officialNarrative: "Border situation remains calm.",
      generalSummary: "Border situation remains calm.",
      keyEvents: [],
    });
  }
  for (const country of ["thailand", "cambodia", "international"]) {
    await writeJsonlFile(
      join(root, "data", "news", "2026-11", `${country}.jsonl`),
      news[country] || [],
    );
  }
  await writeJsonlFile(join(root, "data", "timeline", "2026.jsonl"), timeline);
  return root;
}

function runBrief(root, nowMs) {
  const result = spawnSync(process.execPath, [script], {
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
        localizedNews("intl-noise", "Singapore sand imports affect fishing community", old + 1_000),
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
      news: { thailand: 3, cambodia: 1, international: 1 },
    });
    assert.deepEqual(brief.contextWindow.sinceLastCycleCounts, {
      timeline: 5,
      news: { thailand: 3, cambodia: 1, international: 1 },
    });
    assert.equal(brief.recentTimeline.length, 5);
    assert.deepEqual(
      brief.recentNews.thailand.map((row) => row.id),
      ["th-1", "th-2", "th-fetched"],
    );
    assert.deepEqual(brief.recentNews.international.map((row) => row.id), ["intl-1"]);
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

test("finish allows long quiet intervals and rejects scheduling beyond one week", async () => {
  const root = await mkdtemp(join(tmpdir(), "borderclash-research-cli-"));
  try {
    await mkdir(join(root, "data"), { recursive: true });
    await writeFile(join(root, "data", "state.json"), JSON.stringify({ researchCycleCount: 3 }) + "\n");
    const accepted = spawnSync(process.execPath, [
      script,
      "finish",
      "80",
      "Conditions are quiet and no near-term trigger is visible.",
    ], { cwd: root, encoding: "utf8" });
    assert.equal(accepted.status, 0, accepted.stderr);

    const result = spawnSync(process.execPath, [
      script,
      "finish",
      "169",
      "Too far away.",
    ], { cwd: root, encoding: "utf8" });

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /between 1 and 168/u);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
