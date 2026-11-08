import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const ROOT = path.resolve('src');
const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.css']);
const MOJIBAKE = /(?:\uFFFD|Ã.|Â.|â(?:€|™|œ|“|”|€™)|à¸|à¹|áž|áŸ)/u;

function sourceFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(fullPath);
    return SOURCE_EXTENSIONS.has(path.extname(entry.name)) ? [fullPath] : [];
  });
}

test('UI source contains no obvious mojibake or replacement characters', () => {
  for (const file of sourceFiles(ROOT)) {
    const text = fs.readFileSync(file, 'utf8');
    assert.equal(MOJIBAKE.test(text), false, `encoding corruption detected in ${path.relative(process.cwd(), file)}`);
  }
});
