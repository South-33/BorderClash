import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";

const CONTROL_URL = (process.env.GEMINI_STUDIO_CONTROL_URL
  || "https://believable-unplagiarised-josette.ngrok-free.dev").replace(/\/+$/, "");

function arg(name, fallback = null) {
  const index = process.argv.indexOf(name);
  return index >= 0 && index + 1 < process.argv.length ? process.argv[index + 1] : fallback;
}

const thinking = String(arg("--thinking", "high")).toLowerCase();
if (!new Set(["medium", "high"]).has(thinking)) {
  throw new Error("--thinking must be medium or high");
}

const file = arg("--file");
const inlinePrompt = arg("--prompt");
const preset = arg("--preset", "simple");
let prompt;
if (file) {
  prompt = await readFile(file, "utf8");
} else if (inlinePrompt) {
  prompt = inlinePrompt;
} else if (preset === "json") {
  prompt = `Return exactly one fenced json code block and nothing else. Inside it return this valid JSON object: {"ok":true,"category":"diagnostic"}.`;
} else {
  prompt = "Reply with exactly OK and nothing else.";
}

const timeoutMs = Number(arg("--timeout-ms", "600000"));
const deadline = Date.now() + timeoutMs;
const requestId = `borderclash-probe-${randomUUID()}`;

async function fetchWithTimeout(url, init = {}, timeout = 12_000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function discover() {
  try {
    const response = await fetchWithTimeout(`${CONTROL_URL}/v1/endpoint`, {
      headers: { "ngrok-skip-browser-warning": "true", Accept: "application/json" },
    });
    if (!response.ok) return CONTROL_URL;
    const payload = await response.json();
    return typeof payload.data_plane_url === "string"
      ? payload.data_plane_url.replace(/\/+$/, "")
      : CONTROL_URL;
  } catch {
    return CONTROL_URL;
  }
}

const headers = {
  "Content-Type": "application/json",
  Authorization: "Bearer anything",
  "ngrok-skip-browser-warning": "true",
  "X-Project-Name": "borderclash-diagnostic",
  "X-Client-Name": "gemini-probe",
  "X-Request-ID": requestId,
};

async function request(path, init) {
  const first = await discover();
  const targets = [...new Set([first, CONTROL_URL])];
  let lastError;
  for (const base of targets) {
    try {
      const response = await fetchWithTimeout(`${base}${path}`, init, 15_000);
      if (![502, 503, 504].includes(response.status)) return { response, base };
      lastError = new Error(`${base} returned ${response.status}`);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error("No Gemini endpoint available");
}

const started = Date.now();
const submit = await request("/v1/chat/completions", {
  method: "POST",
  headers,
  body: JSON.stringify({
    model: "flash",
    thinking_level: thinking,
    async: true,
    messages: [{ role: "user", content: prompt }],
    project: "borderclash-diagnostic",
    client: "gemini-probe",
    request_id: requestId,
  }),
});

if (submit.response.status !== 202) {
  const text = await submit.response.text();
  console.log(`probe submit status=${submit.response.status} endpoint=${submit.base} elapsedMs=${Date.now() - started}`);
  console.log(text.slice(0, 1200));
  process.exitCode = submit.response.ok ? 0 : 2;
} else {
  console.log(`probe started id=${requestId} thinking=${thinking} chars=${prompt.length} endpoint=${submit.base}`);
  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 3_000));
    const poll = await request(`/v1/chat/completions/${encodeURIComponent(requestId)}`, {
      method: "GET",
      headers,
    });
    if (poll.response.status === 202) continue;

    const text = await poll.response.text();
    let payload;
    try { payload = JSON.parse(text); } catch { payload = null; }
    const content = payload?.choices?.[0]?.message?.content || "";
    const failed = payload?.status === "failed" || payload?.status === "error" || payload?.status === "timeout";
    console.log(`probe finished status=${poll.response.status} elapsedMs=${Date.now() - started} endpoint=${poll.base} failed=${failed}`);
    if (failed) console.log(`error=${payload?.error || payload?.status}`);
    if (content) console.log(`content=${JSON.stringify(content.slice(0, 1200))}`);
    process.exitCode = failed || !poll.response.ok ? 2 : 0;
    break;
  }

  if (Date.now() >= deadline) {
    console.log(`probe timeout id=${requestId} elapsedMs=${Date.now() - started}`);
    process.exitCode = 3;
  }
}
