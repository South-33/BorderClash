import { randomUUID } from "node:crypto";

const CONTROL_URL = (process.env.GEMINI_STUDIO_CONTROL_URL
  || "https://believable-unplagiarised-josette.ngrok-free.dev").replace(/\/+$/, "");

const THAI_RE = /[\u0E00-\u0E7F]/u;
const KHMER_RE = /[\u1780-\u17FF]/u;
const BAD_TEXT_RE = /(?:\uFFFD|\u00C3.|\u00C2.|\u00E2[\u0080-\u00BF]|\u00F0\u0178|\u00EF\u00BB\u00BF)/u;

const fixture = [
  {
    id: "budget",
    facts: "Thailand allocated 3.5 billion baht to strengthen border defense. The record does not establish that an attack was imminent.",
  },
  {
    id: "displacement",
    facts: "Cambodian authorities say nearly 8,000 Cambodian civilians remain displaced along the Thai border and say Thai restrictions are delaying returns. Treat this as Cambodia's claim unless corroborated.",
  },
  {
    id: "conciliation",
    facts: "Thailand and Cambodia opened the first UNCLOS conciliation session about their maritime boundary. Conciliation is a formal process in which a commission helps the parties seek agreement; it does not impose a binding ruling.",
  },
  {
    id: "monitoring",
    facts: "An ASEAN observer team inspected border sectors and landmine impacts in Si Sa Ket. The visit was for monitoring and fact-finding, not a finding that either side caused the mines.",
  },
];

const contracts = {
  baseline: `Translation: Thai fields must use natural Thai script. Khmer fields must use natural Khmer script. Translate meaning, not word order. Keep labels short.`,
  selected: `Writing and translation:
- Write for an ordinary reader with no military, legal, or diplomatic background. Use short, natural sentences and common words.
- English fields use natural English; Thai fields use natural Thai; Khmer fields use natural Khmer.
- Thai output may use Thai script plus normal digits, punctuation, and common Latin acronyms. Khmer output may use Khmer script plus the same. Never mix Thai and Khmer scripts in one field.
- Use the normal target-language form of country and place names when one exists. Never copy a name in the other language's script.
- Translate meaning, attribution, and uncertainty. Do not translate word-for-word and do not add facts.
- Keep disputed claims attributed to whoever made them. Apply the same standard to Thailand and Cambodia.
- Prefer everyday words. Explain an unavoidable military, legal, or diplomatic term in plain language.
- Before returning JSON, silently check every Thai and Khmer field for wrong-script characters and rewrite any field that fails.`,
};

function parseArgs() {
  const variantIndex = process.argv.indexOf("--variant");
  const variant = variantIndex >= 0 ? process.argv[variantIndex + 1] : null;
  const repeatsIndex = process.argv.indexOf("--repeats");
  const repeats = repeatsIndex >= 0 ? Math.max(1, Number(process.argv[repeatsIndex + 1]) || 1) : 1;
  const selected = variant ? [variant] : Object.keys(contracts);
  for (const name of selected) {
    if (!contracts[name]) throw new Error(`Unknown variant: ${name}`);
  }
  return { selected, repeats };
}

function buildPrompt(contract) {
  return `You edit short BorderClash timeline text about the Thailand-Cambodia border.

Evidence rules:
- Use only the supplied facts.
- Be neutral between Thailand and Cambodia.
- Never invent a source, number, place, motive, or level of certainty.

${contract}

For each item, write:
- titleEn/titleTh/titleKh: a clear headline, about 6-12 words in English and similarly concise in the other languages.
- summaryEn/summaryTh/summaryKh: 1-2 short sentences that an average citizen can understand without prior context.

INPUT:
${JSON.stringify(fixture, null, 2)}

Return exactly one fenced \`\`\`json code block and nothing else:
\`\`\`json
{"items":[{"id":"budget","titleEn":"...","titleTh":"...","titleKh":"...","summaryEn":"...","summaryTh":"...","summaryKh":"..."}]}
\`\`\``;
}

async function fetchWithTimeout(url, init = {}, timeout = 15_000) {
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
    return typeof payload.data_plane_url === "string" ? payload.data_plane_url.replace(/\/+$/, "") : CONTROL_URL;
  } catch {
    return CONTROL_URL;
  }
}

async function apiRequest(path, init) {
  const first = await discover();
  const targets = [...new Set([first, CONTROL_URL])];
  const transientGatewayStatuses = new Set([502, 503, 504, 520, 521, 522, 523, 524, 525, 526, 530]);
  let lastError;
  for (const base of targets) {
    try {
      const response = await fetchWithTimeout(`${base}${path}`, init);
      if (!transientGatewayStatuses.has(response.status)) return response;
      lastError = new Error(`${base} returned ${response.status}`);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error("No Gemini endpoint available");
}

async function runGemini(prompt, label) {
  const requestId = `borderclash-prompt-eval-${label}-${randomUUID()}`;
  const headers = {
    "Content-Type": "application/json",
    Authorization: "Bearer anything",
    "ngrok-skip-browser-warning": "true",
    "X-Project-Name": "borderclash-prompt-eval",
    "X-Client-Name": "prompt-hillclimb",
    "X-Request-ID": requestId,
  };
  const started = Date.now();
  const submit = await apiRequest("/v1/chat/completions", {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: "flash",
      thinking_level: "high",
      async: true,
      messages: [{ role: "user", content: prompt }],
      project: "borderclash-prompt-eval",
      client: "prompt-hillclimb",
      request_id: requestId,
    }),
  });
  if (submit.status !== 202) throw new Error(`submit ${submit.status}: ${(await submit.text()).slice(0, 500)}`);

  // Queue time can be several minutes because production deliberately owns one
  // Gemini browser worker. The server keeps async jobs for up to 45 minutes, so
  // the evaluator must not interpret a healthy queue wait as a model timeout.
  const deadline = Date.now() + 30 * 60_000;
  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 2500));
    let poll;
    try {
      poll = await apiRequest(`/v1/chat/completions/${encodeURIComponent(requestId)}`, { method: "GET", headers });
    } catch (error) {
      // The browser job lives on the server and can outlive either tunnel.
      // A transient polling outage must never resubmit or abandon that job.
      console.warn(`poll transport retry id=${requestId} error=${error?.message || error}`);
      continue;
    }
    if (poll.status === 202) continue;
    const payload = await poll.json();
    if (!poll.ok || payload?.status === "failed" || payload?.status === "error" || payload?.status === "timeout") {
      throw new Error(payload?.error || `poll ${poll.status}`);
    }
    return {
      requestId,
      durationMs: Date.now() - started,
      content: payload?.choices?.[0]?.message?.content || "",
    };
  }
  throw new Error(`poll timeout for ${requestId}`);
}

function extractJson(raw) {
  const fenced = raw.match(/```json\s*([\s\S]*?)```/i);
  const candidate = fenced?.[1] || raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1);
  if (!candidate) return null;
  try { return JSON.parse(candidate.trim()); } catch { return null; }
}

function fieldIssues(value, language) {
  const issues = [];
  if (typeof value !== "string" || !value.trim()) return ["missing"];
  if (BAD_TEXT_RE.test(value)) issues.push("bad-text");
  if (language === "th") {
    if (KHMER_RE.test(value)) issues.push("khmer-in-thai");
    if (!THAI_RE.test(value)) issues.push("no-thai");
  } else if (language === "kh") {
    if (THAI_RE.test(value)) issues.push("thai-in-khmer");
    if (!KHMER_RE.test(value)) issues.push("no-khmer");
  } else {
    if (THAI_RE.test(value) || KHMER_RE.test(value)) issues.push("localized-script-in-english");
  }
  return issues;
}

function semanticIssues(item) {
  const issues = [];
  const title = String(item?.titleEn || "");
  const summary = String(item?.summaryEn || "");
  const text = `${title} ${summary}`.toLowerCase();

  if (/\bkinetic\b|territorialcontext|military posture/i.test(summary)) {
    issues.push("unnecessary-jargon");
  }

  switch (item?.id) {
    case "budget":
      if (!/3\.5/.test(text) || !/baht/.test(text)) issues.push("lost-budget-fact");
      if (!/attack/.test(text) || !/(?:\bnot\b|\bno\b|does not|do not|doesn't)/.test(summary.toLowerCase())) {
        issues.push("lost-no-imminent-attack-caveat");
      }
      break;
    case "displacement":
      if (!/(?:8,?000|8 000)/.test(text)) issues.push("lost-displacement-number");
      if (!/cambod/.test(text) || !/(?:say|says|report|reports|claim|claims|state|states|according)/.test(text)) {
        issues.push("lost-claim-attribution");
      }
      break;
    case "conciliation":
      if (!/(?:unclos|un maritime law)/.test(text)) issues.push("lost-unclos-context");
      if (!/(?:commission|formal process|formal talks|helps? (?:both )?(?:sides|parties)|seek (?:an )?agreement)/.test(text)) {
        issues.push("conciliation-not-explained");
      }
      if (!/(?:not|does not|without|no ).{0,50}(?:binding|impos|ruling|decision)/.test(summary.toLowerCase())) {
        issues.push("lost-nonbinding-caveat");
      }
      break;
    case "monitoring":
      if (!/asean/.test(text) || !/(?:si sa ket|sisaket)/.test(text)) issues.push("lost-monitoring-context");
      if (!/(?:not|did not|without|no ).{0,70}(?:responsib|fault|assign|blam|find|determin)/.test(summary.toLowerCase())) {
        issues.push("lost-no-blame-caveat");
      }
      break;
  }

  return issues;
}

function score(raw) {
  const parsed = extractJson(raw);
  const failures = [];
  if (!parsed || !Array.isArray(parsed.items)) return { score: 0, failures: ["invalid-json-shape"], parsed };
  const byId = new Map(parsed.items.map((item) => [item?.id, item]));
  for (const expected of fixture) {
    const item = byId.get(expected.id);
    if (!item) {
      failures.push(`${expected.id}:missing-item`);
      continue;
    }
    for (const [field, language] of [
      ["titleEn", "en"], ["titleTh", "th"], ["titleKh", "kh"],
      ["summaryEn", "en"], ["summaryTh", "th"], ["summaryKh", "kh"],
    ]) {
      for (const issue of fieldIssues(item[field], language)) failures.push(`${expected.id}.${field}:${issue}`);
    }
    for (const issue of semanticIssues(item)) failures.push(`${expected.id}:semantic:${issue}`);
  }
  const expectedChecks = fixture.length * 7;
  return { score: Math.max(0, expectedChecks - failures.length), maxScore: expectedChecks, failures, parsed };
}

const { selected, repeats } = parseArgs();
const results = [];
for (const variant of selected) {
  const prompt = buildPrompt(contracts[variant]);
  for (let run = 1; run <= repeats; run++) {
    console.log(`\n=== ${variant} run ${run}/${repeats} promptChars=${prompt.length} ===`);
    try {
      const response = await runGemini(prompt, `${variant}-${run}`);
      const result = score(response.content);
      results.push({ variant, run, promptChars: prompt.length, ...response, ...result });
      console.log(`score=${result.score}/${result.maxScore || fixture.length * 7} durationMs=${response.durationMs} failures=${result.failures.length}`);
      if (result.failures.length) console.log(`failures: ${result.failures.join(", ")}`);
      console.log(response.content);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      results.push({ variant, run, promptChars: prompt.length, score: 0, maxScore: fixture.length * 7, failures: [`request-error:${message}`], error: message });
      console.warn(`request failed: ${message}`);
    }
  }
}

console.log("\n=== SUMMARY ===");
for (const result of results) {
  console.log(`${result.variant} run=${result.run} score=${result.score}/${result.maxScore || fixture.length * 7} promptChars=${result.promptChars} durationMs=${result.durationMs ?? "failed"} failures=${result.failures.length}`);
}
