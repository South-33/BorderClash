import { randomUUID } from "node:crypto";

const apiUrl = process.env.GEMINI_STUDIO_API_URL || "http://localhost:8001";
const projectName = process.env.GEMINI_PROJECT_NAME || "borderclash";
const clientName = process.env.GEMINI_CLIENT_NAME || "borderclash-convex";
const thinkingLevel = "medium";
const prompt = "Briefly summarize why cross-checking multiple sources improves news reliability.";

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
      model: "flash",
      thinking_level: thinkingLevel,
      messages: [{ role: "user", content: prompt }],
      project: projectName,
      client: clientName,
      request_id: requestId,
      metadata: { project: projectName, client: clientName },
    };

    console.log(`[verify] sending Flash/${thinkingLevel} requestId=${requestId}`);
    const chatResponse = await fetch(`${apiUrl}/v1/chat/completions`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
    if (!chatResponse.ok) {
      const errorText = await chatResponse.text();
      throw new Error(`Flash/${thinkingLevel} failed (${chatResponse.status}): ${errorText}`);
    }
    const completion = await chatResponse.json();
    const answer = completion?.choices?.[0]?.message?.content;
    if (typeof answer !== "string" || !answer.trim()) {
      throw new Error(`Flash/${thinkingLevel} returned an empty completion`);
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
      String(recordedModel).toLowerCase() !== "flash" ||
      String(recordedLevel).toLowerCase() !== thinkingLevel
    ) {
      throw new Error(`Flash/${thinkingLevel} request missing or mis-recorded in diagnostics`);
    }
    console.log(`[verify] Flash/${thinkingLevel} ok`);
}

run().catch((error) => {
  console.error(`[verify] failed: ${error.message}`);
  process.exitCode = 1;
});
