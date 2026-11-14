import { join } from "node:path";
import { listFiles, readJsonl, writeJsonl } from "./files.mjs";
import { LOCALIZED_NEWS_LIMIT, newsEnvironmentKey, selectVisibleNews } from "./news.mjs";

export async function syncNewsLocalization(dataRoot = "data") {
  const files = await listFiles(join(dataRoot, "news"), ".jsonl");
  const records = [];
  const rowsByFile = new Map();

  for (const file of files) {
    const rows = await readJsonl(file);
    rowsByFile.set(file, rows);
    for (const row of rows) records.push({ row, file });
  }

  const byEnvironment = { thailand: [], cambodia: [] };
  for (const { row } of records) {
    const environment = newsEnvironmentKey(row.mediaEnvironment);
    if (environment === "thailand" || environment === "cambodia") {
      byEnvironment[environment].push(row);
    }
  }

  const localizedIds = new Set([
    ...selectVisibleNews(byEnvironment.thailand, LOCALIZED_NEWS_LIMIT).map(({ id }) => id),
    ...selectVisibleNews(byEnvironment.cambodia, LOCALIZED_NEWS_LIMIT).map(({ id }) => id),
  ]);

  const changedIds = [];
  const changedFiles = new Set();
  for (const { row, file } of records) {
    if (localizedIds.has(row.id)) continue;
    let changed = false;
    for (const field of ["titleTh", "titleKh"]) {
      if (row[field] !== undefined) {
        delete row[field];
        changed = true;
      }
    }
    if (changed) {
      changedIds.push(row.id);
      changedFiles.add(file);
    }
  }

  for (const file of changedFiles) await writeJsonl(file, rowsByFile.get(file));

  return {
    localizedLimit: LOCALIZED_NEWS_LIMIT,
    localizedCount: localizedIds.size,
    strippedCount: changedIds.length,
    strippedIds: changedIds.sort(),
  };
}
