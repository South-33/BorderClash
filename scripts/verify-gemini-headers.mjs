import { randomUUID } from "node:crypto";

const apiUrl = process.env.GEMINI_STUDIO_API_URL || "http://localhost:8001";
const projectName = process.env.GEMINI_PROJECT_NAME || "borderclash";
const clientName = process.env.GEMINI_CLIENT_NAME || "borderclash-convex";
const thinkingLevel = "low";
const prompt = "Briefly summarize why cross-checking multiple sources improves news reliability.";
const transientGeminiReplies = new Set([
    "sorry, something went wrong. please try your request again.",
    "i encountered an error doing what you asked. could you try again?",
    "i seem to be encountering an error. can i try something else for you?",
]);

function isTransientGeminiReply(value) {
    const normalized = String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
    return transientGeminiReplies.has(normalized)
        || (normalized.startsWith("i'm having a hard time fulfilling your request.")
            && normalized.includes("something else instead?"));
}

async function run() {
    const requestId = randomUUID();
    const headers = {
      "Content-Type": "application/json",
      "Authorization": "Bearer anything",
      "ngrok-skip-browser-warning": "true",
      "X-Project-Name": projectName,
      "X-Client-Name": clientName,
      "X-Request-ID": requestId,
    };
    const body = {
      model: "flash-lite",
      thinking_level: thinkingLevel,
      messages: [{ role: "user", content: prompt }],
      project: projectName,
      client: clientName,
      request_id: requestId,
      metadata: { project: projectName, client: clientName },
    };

    console.log(`[verify] sending Flash-Lite/${thinkingLevel} requestId=${requestId}`);
    const chatResponse = await fetch(`${apiUrl}/v1/chat/completions`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
    if (!chatResponse.ok) {
      const errorText = await chatResponse.text();
      throw new Error(`Flash-Lite/${thinkingLevel} failed (${chatResponse.status}): ${errorText}`);
    }
    const completion = await chatResponse.json();
    const answer = completion?.choices?.[0]?.message?.content;
    if (typeof answer !== "string" || !answer.trim()) {
      throw new Error(`Flash-Lite/${thinkingLevel} returned an empty completion`);
    }
    if (isTransientGeminiReply(answer)) {
      throw new Error(`Flash-Lite/${thinkingLevel} returned Gemini's transient failure reply`);
    }

    const diagnosticsResponse = await fetch(`${apiUrl}/v1/diagnostics`);
    if (!diagnosticsResponse.ok) {
      throw new Error(`diagnostics failed (${diagnosticsResponse.status})`);
    }
    const diagnostics = await diagnosticsResponse.json();
    const recentRequests = Array.isArray(diagnostics?.recent_requests) ? diagnostics.recent_requests : [];
    const matched = recentRequests.find((entry) => entry?.request_id === requestId);
    const recordedModel = matched?.resolved_model || matched?.model || matched?.body?.model;
    const recordedLevel = matched?.thinking_level || matched?.body?.thinking_level;
    if (
      !matched ||
      String(recordedModel).toLowerCase() !== "flash-lite" ||
      String(recordedLevel).toLowerCase() !== thinkingLevel
    ) {
      throw new Error(`Flash-Lite/${thinkingLevel} request missing or mis-recorded in diagnostics`);
    }
    console.log(`[verify] Flash-Lite/${thinkingLevel} ok`);
}

run().catch((error) => {
  console.error(`[verify] failed: ${error.message}`);
  process.exitCode = 1;
});
