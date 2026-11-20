import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const readRows = (path) => readFileSync(path, "utf8").trim().split(/\r?\n/u).map(JSON.parse);

test("June tank coverage is one date-only attributed security assessment, not three confirmed deliveries", () => {
  const events = readRows("data/timeline/2026-06.jsonl");
  const event = events.find((row) => row.id === "ks75x82bbh81qnaqn43xzpw4q988d9qr");
  assert.ok(event);
  assert.equal(event.date, "2026-06-10");
  assert.equal(event.timeOfDay, "");
  assert.match(event.description, /after reports that China supplied tanks/u);
  assert.match(event.description, /do not establish an exact tank-delivery date/u);
  assert.deepEqual(event.evidenceIds, [
    "js7azv7ed4m467cw0tf5ft7nqn88csbv",
    "js77j1zhf744r4zc4kp8fnzy8n88jtwn",
    "k97552n4t0hrjmh6y633d44g3588j6yb",
  ]);
  for (const duplicate of ["ks730dbzqsgq12xgt4hjbtvyzx88kx07", "ks75848dchgh4yv0y4zsz1rewh88jcby"]) {
    assert.equal(events.some((row) => row.id === duplicate), false);
  }
});

test("Thai PBS publication is recorded on June 10, not June 8", () => {
  const article = readRows("data/news/2026-06.jsonl").find((row) => row.id === "js7azv7ed4m467cw0tf5ft7nqn88csbv");
  assert.ok(article);
  assert.equal(new Date(article.publishedAt).toISOString().slice(0, 10), "2026-06-10");
});
