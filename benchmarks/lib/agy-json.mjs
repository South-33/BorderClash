import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

export async function runAgyJson({
  agy = process.env.AGY_PATH || "agy",
  cwd,
  model,
  prompt,
  schema,
  printTimeout = process.env.BENCH_TIMEOUT || "150s",
  wallTimeoutMs = Math.max(30_000, Number(process.env.BENCH_WALL_TIMEOUT_MS || 240_000)),
}) {
  return new Promise((done) => {
    const started = performance.now();
    let settled = false;
    let timedOut = false;
    const child = spawn(agy, [
      "-p", prompt,
      "--output-format", "json",
      "--json-schema", JSON.stringify(schema),
      "--model", model,
      "--print-timeout", printTimeout,
      "--disable-slash-commands",
    ], { cwd, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });

    const stdout = [];
    const stderr = [];
    const terminate = () => {
      if (!child.pid || child.killed) return;
      if (process.platform === "win32") {
        spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], { windowsHide: true, stdio: "ignore" });
      } else {
        child.kill("SIGKILL");
      }
    };
    const finish = (value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      done(value);
    };
    const tryFinishEnvelope = () => {
      if (settled) return false;
      const raw = Buffer.concat(stdout).toString("utf8").replace(/^\uFEFF/u, "").trim();
      if (!raw) return false;
      let envelope;
      try { envelope = JSON.parse(raw); } catch { return false; }
      const seconds = (performance.now() - started) / 1000;
      if (envelope.status !== "SUCCESS") {
        terminate();
        finish({ ok: false, error: envelope.error || `status=${envelope.status}`, seconds });
        return true;
      }
      if (!envelope.structured_output) {
        terminate();
        finish({ ok: false, error: "missing structured_output", seconds });
        return true;
      }
      terminate();
      finish({ ok: true, structured: envelope.structured_output, usage: envelope.usage || null, seconds });
      return true;
    };
    const timer = setTimeout(() => {
      timedOut = true;
      terminate();
      finish({ ok: false, error: `wall-timeout-${wallTimeoutMs}ms`, seconds: (performance.now() - started) / 1000 });
    }, wallTimeoutMs);
    timer.unref?.();

    child.stdout.on("data", (chunk) => {
      stdout.push(chunk);
      tryFinishEnvelope();
    });
    child.stderr.on("data", (chunk) => stderr.push(chunk));
    child.on("error", (error) => finish({ ok: false, error: String(error), seconds: (performance.now() - started) / 1000 }));
    child.on("close", (code) => {
      if (settled) return;
      const seconds = (performance.now() - started) / 1000;
      const raw = Buffer.concat(stdout).toString("utf8").replace(/^\uFEFF/u, "");
      const err = Buffer.concat(stderr).toString("utf8");
      if (timedOut) return finish({ ok: false, error: `wall-timeout-${wallTimeoutMs}ms`, seconds });
      if (code !== 0) return finish({ ok: false, error: err || raw, seconds });
      if (tryFinishEnvelope()) return;
      finish({ ok: false, error: `invalid-json: ${raw.slice(0, 500)}`, seconds });
    });
  });
}

export async function runCachedAgyJson({ cacheRoot, fresh = false, cacheSalt = "", ...options }) {
  const key = createHash("sha256")
    .update(JSON.stringify({ model: options.model, prompt: options.prompt, schema: options.schema, cacheSalt }))
    .digest("hex");
  const path = resolve(cacheRoot, `${key}.json`);
  let cached = null;
  try { cached = JSON.parse(await readFile(path, "utf8")); } catch {}
  if (!fresh && cached?.ok) return { ...cached, cached: true };

  const run = await runAgyJson(options);
  await mkdir(cacheRoot, { recursive: true });
  if (run.ok || !cached?.ok) await writeFile(path, JSON.stringify(run, null, 2) + "\n", "utf8");
  return { ...run, cached: false };
}
