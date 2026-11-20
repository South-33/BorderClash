import { join } from "node:path";
import { buildAuditCapturedEvidence } from "../lib/audit-captured-evidence.mjs";
import { loadAuditPacketFromWorktree } from "../lib/audit-packet-loader.mjs";
import { auditReviewPrecheck } from "../lib/audit-review-precheck.mjs";

const id = process.argv[2];
if (!id) throw new Error("usage: node research/automation/precheck-audit-review.mjs <record-id>");
const dataRoot = join(process.cwd(), "data");
const packet = await loadAuditPacketFromWorktree(id, { cwd: process.cwd(), dataRoot });
const capturedPacket = packet.kind === "news" ? { ...packet, evidence: { ...packet.evidence, articles: [packet.record] } } : packet;
const capturedEvidence = await buildAuditCapturedEvidence(capturedPacket);
const result = auditReviewPrecheck(packet, capturedEvidence);
process.stdout.write(JSON.stringify(result, null, 2) + "\n");
if (!result.ok) process.exitCode = 2;
