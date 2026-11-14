import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import http from "node:http";
import { dirname, join, resolve } from "node:path";

function arg(name) {
  const index = process.argv.indexOf(`--${name}`);
  if (index < 0 || index + 1 >= process.argv.length) throw new Error(`missing --${name}`);
  return process.argv[index + 1];
}

const remote = resolve(arg("remote"));
const portFile = resolve(arg("port-file"));
const workDir = resolve(arg("work-dir"));
const modeFile = process.argv.includes("--mode-file") ? resolve(arg("mode-file")) : "";
let cachedCommit = "";
let dashboard = "";
let timeline = "";

function runGit(args, cwd) {
  const result = spawnSync("git", args, { cwd, encoding: "utf8", windowsHide: true });
  if (result.status !== 0) throw new Error((result.stderr || result.stdout || "git failed").trim());
  return result.stdout.trim();
}

async function mode() {
  if (!modeFile || !existsSync(modeFile)) return {};
  try {
    return JSON.parse(await readFile(modeFile, "utf8"));
  } catch {
    return {};
  }
}

async function render(commit) {
  if (commit === cachedCommit && dashboard && timeline) return;
  if (!existsSync(workDir)) {
    await mkdir(dirname(workDir), { recursive: true });
    runGit(["clone", "--quiet", "--no-checkout", remote, workDir], dirname(workDir));
  }
  runGit(["fetch", "--quiet", "origin", "main"], workDir);
  runGit(["checkout", "--quiet", "--force", "--detach", commit], workDir);
  await rm(join(workDir, "public", "data"), { recursive: true, force: true });
  const generated = spawnSync(process.execPath, [join(workDir, "scripts", "generate-public.mjs")], {
    cwd: workDir,
    encoding: "utf8",
    windowsHide: true,
    env: { ...process.env, GIT_COMMIT_SHA: commit },
  });
  if (generated.status !== 0) throw new Error((generated.stderr || generated.stdout || "generation failed").trim());
  dashboard = await readFile(join(workDir, "public", "data", "dashboard.json"), "utf8");
  timeline = await readFile(join(workDir, "public", "data", "timeline.json"), "utf8");
  cachedCommit = commit;
}

const server = http.createServer(async (request, response) => {
  try {
    const currentMode = await mode();
    if (currentMode.fail) {
      response.writeHead(503, { "content-type": "text/plain" });
      response.end("temporary failure");
      return;
    }
    const remoteHead = runGit(["--git-dir", remote, "rev-parse", "refs/heads/main"]);
    const commit = currentMode.commit || remoteHead;
    await render(commit);
    let body;
    if (request.url?.startsWith("/data/dashboard.json")) {
      body = currentMode.invalid ? "{invalid" : dashboard;
    } else if (request.url?.startsWith("/data/timeline.json")) {
      body = timeline;
    } else {
      response.writeHead(404);
      response.end();
      return;
    }
    response.writeHead(200, {
      "content-type": "application/json",
      "cache-control": "no-store",
    });
    response.end(body);
  } catch (error) {
    response.writeHead(500, { "content-type": "text/plain" });
    response.end(error?.stack || String(error));
  }
});

server.listen(0, "127.0.0.1", async () => {
  const address = server.address();
  await mkdir(dirname(portFile), { recursive: true });
  await writeFile(portFile, String(address.port), "utf8");
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
