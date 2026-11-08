import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, extname, join } from "node:path";

export async function ensureParent(path) {
  await mkdir(dirname(path), { recursive: true });
}

export async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

export async function writeJson(path, value) {
  await ensureParent(path);
  await writeFile(path, JSON.stringify(value, null, 2) + "\n", "utf8");
}

export async function readJsonl(path) {
  const text = await readFile(path, "utf8");
  return text
    .split(/\r?\n/u)
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

export async function writeJsonl(path, values) {
  await ensureParent(path);
  const text = values.map((value) => JSON.stringify(value)).join("\n");
  await writeFile(path, text ? text + "\n" : "", "utf8");
}

export async function listFiles(root, extension = "") {
  const files = [];

  async function walk(dir) {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(path);
      } else if (!extension || extname(entry.name) === extension) {
        files.push(path);
      }
    }
  }

  await walk(root);
  return files.sort();
}

export async function writeJsonArrayOnePerLine(path, values) {
  await ensureParent(path);
  const body = values.map((value) => JSON.stringify(value)).join(",\n");
  await writeFile(path, "[\n" + body + (body ? "\n" : "") + "]\n", "utf8");
}

