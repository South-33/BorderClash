import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
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
    injuries: { value: null, qualifier: "NO_COMBINED_TOTAL" },
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

function runAsync(args, cwd = process.cwd()) {
  return new Promise((resolveResult, reject) => {
    const child = spawn(process.execPath, [script, ...args], { cwd, encoding: "utf8" });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", reject);
    child.on("close", (status) => resolveResult({ status, stdout, stderr }));
  });
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

test("finish owns cycle timestamps and preserves pause state", async () => {
  const root = await mkdtemp(join(tmpdir(), "borderclash-research-cli-"));
  try {
    await mkdir(join(root, "data"), { recursive: true });
    await writeFile(join(root, "data", "research-state.json"), JSON.stringify({
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
    const state = JSON.parse(await readFile(join(root, "data", "research-state.json"), "utf8"));
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
    await writeFile(join(root, "data", "research-state.json"), JSON.stringify({ researchCycleCount: 3 }) + "\n");
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

test("source follows a redirect and returns publisher metadata", async () => {
  const server = createServer((request, response) => {
    if (request.url === "/grounding") {
      response.writeHead(302, { location: "/publisher/article" });
      response.end();
      return;
    }
    response.writeHead(200, { "content-type": "text/html" });
    response.end(`<!doctype html><html><head>
      <meta property="og:title" content="Border update &amp; talks">
      <meta property="article:published_time" content="2026-11-10T09:30:00Z">
      <meta name="description" content="A concise publisher description.">
    </head><body>publisher</body></html>`);
  });
  await new Promise((resolveListen) => server.listen(0, "127.0.0.1", resolveListen));
  try {
    const address = server.address();
    const result = await runAsync(["source", `http://127.0.0.1:${address.port}/grounding`]);
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(JSON.parse(result.stdout), {
      url: `http://127.0.0.1:${address.port}/publisher/article`,
      status: 200,
      ok: true,
      usable: true,
      title: "Border update & talks",
      publishedAt: "2026-11-10T09:30:00Z",
      description: "A concise publisher description.",
    });
  } finally {
    await new Promise((resolveClose) => server.close(resolveClose));
  }
});

test("source rejects non-http URLs", () => {
  const result = spawnSync(process.execPath, [script, "source", "file:///tmp/source"], {
    cwd: process.cwd(),
    encoding: "utf8",
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /HTTP\(S\)/u);
});

test("source reports network failures as unusable instead of crashing", async () => {
  const server = createServer((_request, response) => response.end("unused"));
  await new Promise((resolveListen) => server.listen(0, "127.0.0.1", resolveListen));
  const address = server.address();
  await new Promise((resolveClose) => server.close(resolveClose));

  const result = spawnSync(process.execPath, [script, "source", `http://127.0.0.1:${address.port}/closed`], {
    cwd: process.cwd(),
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr);
  const output = JSON.parse(result.stdout);
  assert.equal(output.status, null);
  assert.equal(output.ok, false);
  assert.equal(output.usable, false);
  assert.equal(typeof output.error, "string");
});

test("--help is a successful alias for help", () => {
  const result = spawnSync(process.execPath, [script, "--help"], {
    cwd: process.cwd(),
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /source <url>/u);
  assert.doesNotMatch(result.stdout, /research check/u);
});
