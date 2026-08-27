# Gemini website contract

This is the small, current contract used by BorderClash's browser-backed Gemini calls. Keep it focused on behavior we depend on, not incidental generated class names.

## Request and response

- BorderClash sends research, verification, historian, and synthesis prompts through `convex/ai_utils.ts`.
- Each request asks Gemini to put `response=good` on the first line.
- The shared helper removes that line before returning the answer to the existing JSON/prose parsers.
- A response without the marker is treated as an unsuccessful attempt and follows the existing bounded retry/fallback path. The Gemini Studio API itself remains generic and does not enforce this marker.

## UI behavior we rely on

- Use Gemini Chat, not Spark.
- Use a fresh Temporary Chat for each request, then leave the page ready for the next request.
- Select model families by visible `Flash`, `Lite`, or `Pro` text. Version numbers may change.
- Select Extended thinking by its visible label when requested.
- Read answer content through Gemini's Copy control and clipboard. DOM text is diagnostic only.

## Recovery signals

- A request is progressing when the input is cleared, a user message appears, and Gemini's response/reasoning area changes.
- A completed answer exposes the Copy control. If progress stops, use the worker's bounded recovery and retry flow rather than waiting forever.
- Capture diagnostics before recreating a page so the failure remains explainable.

When Gemini's UI changes, update the shared selectors/behavior implementation and this contract together, then run `npm run test:pipeline`.
