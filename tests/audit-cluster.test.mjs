import assert from "node:assert/strict";
import test from "node:test";
import { buildAuditCluster } from "../research/lib/audit-cluster.mjs";

const articles = [
  { id: "a", source: "Source A", title: "Diplomats inspect Thmor Da", summary: "Delegation visits Pursat border." },
  { id: "b", source: "Source B", title: "UN representatives visit Pursat", summary: "Prak Sokhonn leads foreign envoys." },
  { id: "c", source: "Source C", title: "Unrelated maritime patrol", summary: "Navy patrols the Gulf." },
];

const timeline = [
  {
    id: "target",
    date: "2026-03-27",
    category: "diplomatic",
    importance: 72,
    title: "UN Envoys Inspect Thai Fortifications in Pursat",
    description: "Prak Sokhonn led foreign diplomats and UN representatives to Thmor Da in Pursat to inspect alleged Thai occupation and border barriers.",
    evidenceIds: ["a"],
  },
  {
    id: "duplicate",
    date: "2026-03-27",
    category: "diplomatic",
    importance: 74,
    title: "UN and Foreign Envoys Inspect Pursat Border Claims",
    description: "Prak Sokhonn led diplomats and UN officials to the Pursat border to document alleged Thai encroachment.",
    evidenceIds: ["b"],
  },
  {
    id: "same-evidence",
    date: "2026-03-28",
    category: "diplomatic",
    importance: 60,
    title: "Follow-up on Pursat inspection",
    description: "A later write-up repeats the visit.",
    evidenceIds: ["a"],
  },
  {
    id: "unrelated",
    date: "2026-03-27",
    category: "military",
    importance: 80,
    title: "Thai Navy Patrols Gulf Waters",
    description: "The navy monitored maritime traffic in the Gulf of Thailand.",
    evidenceIds: ["c"],
  },
];

test("audit cluster ranks likely duplicate neighbors and excludes unrelated same-day events", () => {
  const result = buildAuditCluster({ id: "target", timeline, articles, windowDays: 2, limit: 5 });
  assert.equal(result.target.id, "target");
  assert.deepEqual(result.candidates.map(({ id }) => id), ["duplicate", "same-evidence"]);
  assert.match(result.candidates[0].reasons.join(" "), /same event date/u);
  assert.match(result.candidates[1].reasons.join(" "), /shared evidence/u);
  assert.equal(result.candidates.some(({ id }) => id === "unrelated"), false);
  assert.equal(result.candidates[0].evidence[0].id, "b");
});

test("audit cluster rejects unknown timeline ids", () => {
  assert.throws(() => buildAuditCluster({ id: "missing", timeline, articles }), /unknown timeline id/u);
});
