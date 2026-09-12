import test from 'node:test';
import assert from 'node:assert/strict';
import { createGenreCache } from '../src/lib/server/genre-cache.js';
const genres = [{ id: 27, name: 'Horror' }];
const DAY = 86400000;

test('cold starts read fresh Mongo metadata instead of fetching TMDB again', async () => {
  let document = null,
    calls = 0;
  const deps = {
    now: () => 100 * DAY,
    read: async () => document,
    write: async (v) => {
      document = v;
    },
    fetchGenres: async () => {
      calls++;
      return genres;
    }
  };
  const first = createGenreCache(deps);
  await Promise.all([first(), first(), first()]);
  assert.equal(calls, 1);
  assert.deepEqual(await createGenreCache(deps)(), genres);
  assert.equal(calls, 1);
});
test('stale metadata refreshes once and concurrent callers share the refresh', async () => {
  let calls = 0,
    document = { genres: [], fetchedAt: new Date(97 * DAY).toISOString() };
  const get = createGenreCache({
    now: () => 100 * DAY,
    read: async () => document,
    write: async (v) => {
      document = v;
    },
    fetchGenres: async () => {
      calls++;
      return genres;
    }
  });
  const results = await Promise.all([get(), get(), get()]);
  assert.equal(calls, 1);
  assert.ok(results.every((r) => r[0].name === 'Horror'));
  assert.equal(document.fetchedAt, new Date(100 * DAY).toISOString());
});
test('refresh failure retains saved genres and backs off before retrying', async () => {
  let now = 100 * DAY,
    calls = 0;
  const get = createGenreCache({
    now: () => now,
    read: async () => ({ genres, fetchedAt: new Date(98 * DAY).toISOString() }),
    write: async () => {},
    fetchGenres: async () => {
      calls++;
      throw new Error('offline');
    }
  });
  assert.deepEqual(await get(), genres);
  assert.deepEqual(await get(), genres);
  assert.equal(calls, 1);
  now += 6 * 60000;
  assert.deepEqual(await get(), genres);
  assert.equal(calls, 2);
});
test('first-use provider failure returns no genres rather than breaking search', async () => {
  const get = createGenreCache({
    read: async () => null,
    write: async () => {},
    fetchGenres: async () => {
      throw new Error('offline');
    }
  });
  assert.deepEqual(await get(), []);
});
