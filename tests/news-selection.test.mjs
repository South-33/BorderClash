import assert from 'node:assert/strict';
import test from 'node:test';

import { selectVisibleNews } from '../research/lib/news.mjs';

test('public news selection is strictly newest-first among visible records', () => {
  const rows = [
    { id: 'older-active', status: 'active', publishedAt: 100, fetchedAt: 500 },
    { id: 'newest-unverified', status: 'unverified', publishedAt: 400, fetchedAt: 410 },
    { id: 'middle-active', status: 'active', publishedAt: 300, fetchedAt: 305 },
    { id: 'fallback-active', status: 'active', fetchedAt: 200 },
    { id: 'archived-newer', status: 'archived', publishedAt: 999, fetchedAt: 999 },
  ];

  assert.deepEqual(
    selectVisibleNews(rows, 3).map((row) => row.id),
    ['newest-unverified', 'middle-active', 'fallback-active'],
  );
});
