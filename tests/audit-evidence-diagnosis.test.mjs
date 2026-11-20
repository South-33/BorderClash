import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { buildAuditEvidenceDiagnosis } from "../research/lib/audit-evidence-diagnosis.mjs";

async function writeCapture(root, id, text, status = "captured-html") {
  const key = `capture-${id}`;
  const articleRoot = join(root, id);
  const captureRoot = join(articleRoot, "captures", key);
  await mkdir(captureRoot, { recursive: true });
  await writeFile(join(articleRoot, "manifest.json"), JSON.stringify({ latestCapture: key, latestStatus: status }), "utf8");
  const storedText = status === "captured-html" && text.length < 300 ? `${text}\n${"x".repeat(300)}` : text;
  await writeFile(join(captureRoot, "text.txt"), storedText, "utf8");
}

async function writeStatus(root, id, status) {
  const articleRoot = join(root, id);
  await mkdir(articleRoot, { recursive: true });
  await writeFile(join(articleRoot, "manifest.json"), JSON.stringify({ latestCapture: "", latestStatus: status }), "utf8");
}

const target = {
  id: "target",
  date: "2026-02-14",
  timeOfDay: "16:25",
  category: "military",
  title: "Navy Reports Cambodian Patrol Took Control of Fishing Vessel",
  description: "Cambodian maritime patrol reportedly took control of a fishing vessel near Koh Kong.",
  evidenceIds: ["blocked"],
};

const articles = [
  {
    id: "blocked",
    source: "Blocked Source",
    sourceUrl: "https://example.test/blocked",
    publishedAt: Date.UTC(2026, 1, 16),
    category: "military",
    title: "Navy Reports Cambodian Patrol Took Control of Fishing Vessel",
    summary: "Report about the fishing vessel near Koh Kong.",
  },
  {
    id: "lead",
    source: "Captured Alternative",
    sourceUrl: "https://example.test/lead",
    publishedAt: Date.UTC(2026, 1, 16),
    category: "military",
    title: "Cambodian Patrol Took Control of Fishing Vessel",
    summary: "The navy reported that the fishing vessel was taken under control near Koh Kong at about 16:25.",
  },
  {
    id: "noise",
    source: "Unrelated",
    sourceUrl: "https://example.test/noise",
    publishedAt: Date.UTC(2026, 1, 14),
    category: "diplomatic",
    title: "Ministers Discuss Trade",
    summary: "A trade meeting took place.",
  },
];

test("diagnosis turns blocked cited evidence into a concise replacement-source plan", async () => {
  const archiveRoot = await mkdtemp(join(tmpdir(), "borderclash-audit-diagnosis-"));
  await writeStatus(archiveRoot, "blocked", "access-blocked");
  await writeCapture(archiveRoot, "lead", "At about 16:25 the Cambodian patrol took control of the fishing vessel near Koh Kong.");

  const result = await buildAuditEvidenceDiagnosis({
    id: "target",
    timeline: [target],
    articles,
    archiveRoot,
  });

  assert.equal(result.evidenceState, "replacement-needed");
  assert.equal(result.nextAction, "review-existing-leads");
  assert.equal(result.citedEvidence[0].captureStatus, "access-blocked");
  assert.equal(result.existingArticleLeads[0].id, "lead");
  assert.equal(result.existingArticleLeads[0].captureFound, true);
  assert.equal(result.exactTime.supported, false);
  assert.equal(result.searchQueries.length, 2);
});

test("diagnosis marks fully captured cited evidence with supported exact time as ready", async () => {
  const archiveRoot = await mkdtemp(join(tmpdir(), "borderclash-audit-diagnosis-ready-"));
  await writeCapture(archiveRoot, "blocked", "The incident occurred at approximately 16:25 on February 14.");

  const result = await buildAuditEvidenceDiagnosis({
    id: "target",
    timeline: [target],
    articles,
    archiveRoot,
  });

  assert.equal(result.evidenceState, "ready");
  assert.equal(result.nextAction, "review-captured-evidence");
  assert.equal(result.exactTime.supported, true);
  assert.deepEqual(result.exactTime.matchedArticleIds, ["blocked"]);
});

test("diagnosis treats a legacy short HTML shell as uncaptured evidence", async () => {
  const archiveRoot = await mkdtemp(join(tmpdir(), "borderclash-audit-diagnosis-short-html-"));
  const key = "capture-blocked";
  const articleRoot = join(archiveRoot, "blocked");
  const captureRoot = join(articleRoot, "captures", key);
  await mkdir(captureRoot, { recursive: true });
  await writeFile(join(articleRoot, "manifest.json"), JSON.stringify({ latestCapture: key, latestStatus: "captured-html" }), "utf8");
  await writeFile(join(captureRoot, "text.txt"), "Generic site shell only", "utf8");

  const result = await buildAuditEvidenceDiagnosis({ id: "target", timeline: [target], articles, archiveRoot });
  assert.equal(result.evidenceState, "replacement-needed");
  assert.equal(result.citedEvidence[0].captureFound, false);
  assert.equal(result.citedEvidence[0].captureStatus, "captured-html");
  assert.equal(result.citedEvidence[0].captureQuality, "short-html-title-mismatch");
});

test("diagnosis does not promote weak contextual articles as replacement leads", async () => {
  const archiveRoot = await mkdtemp(join(tmpdir(), "borderclash-audit-diagnosis-weak-"));
  await writeStatus(archiveRoot, "blocked", "access-blocked");
  const contextual = {
    id: "context",
    source: "Context Source",
    sourceUrl: "https://example.test/context",
    publishedAt: Date.UTC(2026, 1, 13),
    category: "military",
    title: "Army Warns of Renewed Conflict",
    summary: "Army readiness and border security remain concerns as officials discuss possible renewed conflict.",
  };
  await writeCapture(archiveRoot, "context", "Captured contextual article.");

  const result = await buildAuditEvidenceDiagnosis({
    id: "target",
    timeline: [target],
    articles: [...articles.slice(0, 1), contextual],
    archiveRoot,
  });

  assert.equal(result.nextAction, "research-replacement-source");
  assert.deepEqual(result.existingArticleLeads, []);
});
