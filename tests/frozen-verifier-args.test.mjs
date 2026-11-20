import assert from "node:assert/strict";
import test from "node:test";
import {
  effectiveBaselineRef,
  parseArgs,
  verificationIndexRelativePaths,
} from "../research/automation/verify-frozen-correction.mjs";

test("committed verification defaults baseline to the target parent", () => {
  const args = parseArgs(["--target", "abc123"]);
  assert.equal(args.target, "abc123");
  assert.equal(args.baselineExplicit, false);
  assert.equal(effectiveBaselineRef(args), "abc123^");
});

test("committed verification honors an explicit baseline", () => {
  const args = parseArgs(["--target", "abc123", "--baseline", "base456"]);
  assert.equal(args.baselineExplicit, true);
  assert.equal(effectiveBaselineRef(args), "base456");
});

test("dirty verification keeps HEAD as its default baseline", () => {
  const args = parseArgs([]);
  assert.equal(args.target, "");
  assert.equal(args.staged, false);
  assert.equal(effectiveBaselineRef(args), "HEAD");
});

test("staged verification is explicit and keeps HEAD as its baseline", () => {
  const args = parseArgs(["--staged"]);
  assert.equal(args.target, "");
  assert.equal(args.staged, true);
  assert.equal(effectiveBaselineRef(args), "HEAD");
});

test("staged verification cannot be combined with committed verification", () => {
  assert.throws(
    () => parseArgs(["--staged", "--target", "abc123"]),
    /--staged cannot be combined with --target/u,
  );
});

test("committed verification has a stable exact-target result index", () => {
  const paths = verificationIndexRelativePaths({ targetCommit: "abc123" });
  assert.match(paths.latest.replaceAll("\\", "/"), /correction-verifications\/latest\.json$/u);
  assert.match(paths.exact.replaceAll("\\", "/"), /correction-verifications\/by-target\/abc123\.json$/u);
});

test("dirty verification index is tied to source fingerprint", () => {
  const paths = verificationIndexRelativePaths({
    sourceHead: "abc123",
    sourceFingerprint: "1234567890abcdef9999",
  });
  assert.match(
    paths.exact.replaceAll("\\", "/"),
    /correction-verifications\/by-source\/abc123-1234567890abcdef9999\.json$/u,
  );
});
