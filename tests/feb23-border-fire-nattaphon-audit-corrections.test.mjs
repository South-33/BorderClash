import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(path, "utf8").trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
const eventId = "ks766skj7gsdthhmnsg7d6j74581sqhm";
const evidenceId = "js75zkpy8ng5x4j4yfbhbmdx9d81sv50";

test("February 23 wildfire row removes unsupported 14:00 and keeps the event date", () => {
  const event = read("data/timeline/2026-02.jsonl").find((row) => row.id === eventId);
  assert.ok(event);
  assert.equal(event.date, "2026-02-23");
  assert.equal(event.timeOfDay, undefined);
  assert.equal(event.status, "unverified");
  assert.deepEqual(event.evidenceIds, [evidenceId]);
});

test("arson remains a Thai government allegation and fencing is not presented as a causal response", () => {
  const event = read("data/timeline/2026-02.jsonl").find((row) => row.id === eventId);
  assert.match(event.description, /Thai Defence Minister Gen Nattaphon Nakpanich/u);
  assert.match(event.description, /Cambodian Defence Minister Tea Seiha/u);
  assert.match(event.description, /Thai government allegation/u);
  assert.match(event.description, /does not independently establish who started the fires/u);
  assert.match(event.description, /Ban Khlong Luek in Sa Kaeo and Thmor Da in Trat/u);
  assert.match(event.description, /does not establish that this fencing proposal was a direct response/u);
  assert.match(event.description, /gives no exact time/u);
});

test("Thai and Khmer copies preserve attribution, locations, and time uncertainty", () => {
  const event = read("data/timeline/2026-02.jsonl").find((row) => row.id === eventId);
  assert.match(event.descriptionTh, /คำกล่าวของรัฐบาลไทย/u);
  assert.match(event.descriptionTh, /บ้านคลองลึก/u);
  assert.match(event.descriptionTh, /ทมอดา/u);
  assert.match(event.descriptionTh, /ไม่ได้ระบุเวลาสัมภาษณ์ที่แน่นอน/u);
  assert.match(event.descriptionKh, /ការអះអាងរបស់រដ្ឋាភិបាលថៃ/u);
  assert.match(event.descriptionKh, /Ban Khlong Luek/u);
  assert.match(event.descriptionKh, /Thmor Da/u);
  assert.match(event.descriptionKh, /មិនបានផ្តល់ម៉ោងសម្ភាសន៍ជាក់លាក់ទេ/u);
});

test("news summary separates the minister's allegation from the fencing discussion", () => {
  const article = read("data/news/2026-02.jsonl").find((row) => row.id === evidenceId);
  assert.ok(article);
  assert.match(article.summary, /Thai minister's allegation/u);
  assert.match(article.summary, /does not establish the fencing discussion as a direct response/u);
});
