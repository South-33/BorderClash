function jsonlRows(text) {
  return String(text || "")
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean)
    .map(JSON.parse);
}

function rowMap(rows) {
  return new Map(rows.map((row) => [row.id, row]));
}

function sameRow(left, right) {
  if (left == null || right == null) return left == null && right == null;
  return JSON.stringify(left) === JSON.stringify(right);
}

export function mergeJsonlRecordText(baseText, workerText, primaryText) {
  const baseRows = jsonlRows(baseText);
  const workerRows = jsonlRows(workerText);
  const primaryRows = jsonlRows(primaryText);
  const base = rowMap(baseRows);
  const worker = rowMap(workerRows);
  const primary = rowMap(primaryRows);
  const ids = new Set([...base.keys(), ...worker.keys()]);
  const changedIds = [...ids].filter((id) => !sameRow(base.get(id), worker.get(id))).sort();
  const overlapIds = changedIds.filter((id) => !sameRow(base.get(id), primary.get(id)));
  if (overlapIds.length) {
    return { ok: false, text: primaryText, changedIds, overlapIds };
  }

  const workerById = new Map(workerRows.map((row) => [row.id, row]));
  const changed = new Set(changedIds);
  const output = [];
  const emitted = new Set();
  for (const row of primaryRows) {
    if (!changed.has(row.id)) {
      output.push(row);
      continue;
    }
    const replacement = workerById.get(row.id);
    if (replacement) {
      output.push(replacement);
      emitted.add(row.id);
    }
  }
  for (const row of workerRows) {
    if (changed.has(row.id) && !emitted.has(row.id) && !primary.has(row.id)) {
      output.push(row);
      emitted.add(row.id);
    }
  }
  return {
    ok: true,
    text: output.map((row) => JSON.stringify(row)).join("\n") + "\n",
    changedIds,
    overlapIds: [],
  };
}

