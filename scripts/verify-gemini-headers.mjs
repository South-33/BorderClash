import { randomUUID } from "node:crypto";

const apiUrl = process.env.GEMINI_STUDIO_API_URL || "http://localhost:8001";
const projectName = process.env.GEMINI_PROJECT_NAME || "borderclash";
const clientName = process.env.GEMINI_CLIENT_NAME || "borderclash-convex";
const requestId = process.env.GEMINI_REQUEST_ID || randomUUID();

const baseHeaders = {
  "Content-Type": "application/json",
  "Authorization": "Bearer anything",
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Accept": "application/json, text/plain, */*",
  "Accept-Language": "en-US,en;q=0.9",
  "X-Project-Name": projectName,
  "X-Client-Name": clientName,
  "X-Request-ID": requestId,
};

const body = {
  model: "fast",
  messages: [{ role: "user", content: "Return exactly: ok" }],
  project: projectName,
  client: clientName,
  request_id: requestId,
  metadata: {
    project: projectName,
    client: clientName,
  },
};

async function run() {
  console.log(`[verify] sending test request with requestId=${requestId}`);

  const chatResponse = await fetch(`${apiUrl}/v1/chat/completions`, {
    method: "POST",
    headers: baseHeaders,
    body: JSON.stringify(body),
  });

  if (!chatResponse.ok) {
    const errorText = await chatResponse.text();
    throw new Error(`chat completion failed (${chatResponse.status}): ${errorText}`);
  }

  await chatResponse.json();
  console.log("[verify] chat completion request succeeded");

  const diagnosticsResponse = await fetch(`${apiUrl}/v1/diagnostics`);
  if (!diagnosticsResponse.ok) {
    const errorText = await diagnosticsResponse.text();
    throw new Error(`diagnostics failed (${diagnosticsResponse.status}): ${errorText}`);
  }

  const diagnostics = await diagnosticsResponse.json();
  const recentRequests = Array.isArray(diagnostics?.recent_requests)
    ? diagnostics.recent_requests
    : [];

  const matched = recentRequests.find((entry) =>
    entry?.request_id === requestId ||
    entry?.headers?.["x-request-id"] === requestId ||
    entry?.headers?.["X-Request-ID"] === requestId
  );

  if (!matched) {
    throw new Error("request not found in diagnostics.recent_requests");
  }

  console.log("[verify] diagnostics match found");
  console.log(JSON.stringify({
    requestId,
    projectName,
    clientName,
    diagnosticsMatch: {
      request_id: matched?.request_id,
      project: matched?.project,
      client: matched?.client,
      headerProject: matched?.headers?.["x-project-name"] || matched?.headers?.["X-Project-Name"],
      headerClient: matched?.headers?.["x-client-name"] || matched?.headers?.["X-Client-Name"],
      headerRequestId: matched?.headers?.["x-request-id"] || matched?.headers?.["X-Request-ID"],
    },
  }, null, 2));
}

run().catch((error) => {
  console.error(`[verify] failed: ${error.message}`);
  process.exitCode = 1;
});
