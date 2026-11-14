import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { syncNewsLocalization } from "../research/lib/news-localization.mjs";

async function writeJsonl(path, rows) {
  await mkdir(join(path, ".."), { recursive: true });
  await writeFile(path, rows.map((row) => JSON.stringify(row)).join("\n") + "\n", "utf8");
}

test("news localization sync strips titles only after records leave the newest domestic window", async () => {
  const root = await mkdtemp(join(tmpdir(), "borderclash-news-localization-"));
  const news = join(root, "news");
  const thailand = Array.from({ length: 21 }, (_, index) => ({
    id: `thai-${index}`,
    mediaEnvironment: "thailand-domestic",
    status: "active",
    publishedAt: index + 1,
    title: `Thai ${index}`,
    titleTh: `ไทย ${index}`,
    titleKh: `ថៃ ${index}`,
  }));
  const cambodia = [{
    id: "cambodia-visible",
    mediaEnvironment: "cambodia-domestic",
    status: "active",
    publishedAt: 100,
    title: "Cambodia visible",
    titleTh: "กัมพูชา",
    titleKh: "កម្ពុជា",
  }];
  const international = [{
    id: "international-never-localized",
    mediaEnvironment: "international",
    status: "active",
    publishedAt: 200,
    title: "International",
    titleTh: "นานาชาติ",
    titleKh: "អន្តរជាតិ",
  }];
  await writeJsonl(join(news, "2026-01.jsonl"), [...thailand, ...cambodia, ...international]);

  const result = await syncNewsLocalization(root);
  const rows = (await readFile(join(news, "2026-01.jsonl"), "utf8"))
    .trim().split(/\r?\n/u).map(JSON.parse);
  const byId = new Map(rows.map((row) => [row.id, row]));

  assert.equal(result.localizedCount, 21);
  assert.deepEqual(result.strippedIds, ["international-never-localized", "thai-0"]);
  assert.equal(byId.get("thai-0").titleTh, undefined);
  assert.equal(byId.get("thai-0").titleKh, undefined);
  assert.equal(byId.get("thai-1").titleTh, "ไทย 1");
  assert.equal(byId.get("cambodia-visible").titleKh, "កម្ពុជា");
  assert.equal(byId.get("international-never-localized").titleTh, undefined);
});
