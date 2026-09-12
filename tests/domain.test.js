import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  addEntry,
  addViewing,
  editViewing,
  removeViewing,
  removeEntry,
  projectCollection,
  parseYear
} from '../src/lib/server/domain.js';
import { createLocalStore } from '../src/lib/server/local-store.js';
import { validDate } from '../src/lib/dates.js';
const movie = { tmdbId: 948, title: 'Halloween', releaseDate: '1978-10-25', posterPath: null };
const empty = () => ({ movies: [], yearEntries: [], viewings: [] });

test('a movie is shared between years while watch state stays independent', () => {
  const state = empty();
  const a = addEntry(state, 2026, movie).entry;
  addEntry(state, 2027, movie);
  addViewing(state, a._id, '2026-09-18');
  assert.equal(state.movies.length, 1);
  assert.equal(projectCollection(state, 2026).entries[0].viewings.length, 1);
  assert.equal(projectCollection(state, 2027).entries[0].viewings.length, 0);
});
test('duplicate additions are idempotent and do not erase viewings', () => {
  const state = empty();
  const entry = addEntry(state, 2026, movie).entry;
  addViewing(state, entry._id, '2026-09-18');
  assert.equal(addEntry(state, 2026, movie).alreadyAdded, true);
  assert.equal(state.yearEntries.length, 1);
  assert.equal(state.viewings.length, 1);
});
test('rewatches including two on the same date are distinct, editable records', () => {
  const state = empty();
  const entry = addEntry(state, 2026, movie).entry;
  const a = addViewing(state, entry._id, '2026-09-18');
  const b = addViewing(state, entry._id, '2026-09-18');
  assert.notEqual(a._id, b._id);
  editViewing(state, b._id, '2026-09-19');
  assert.deepEqual(
    projectCollection(state, 2026).entries[0].viewings.map((v) => v.watchedOn),
    ['2026-09-19', '2026-09-18']
  );
  removeViewing(state, a._id);
  assert.equal(projectCollection(state, 2026).entries[0].viewings.length, 1);
  removeViewing(state, b._id);
  assert.equal(projectCollection(state, 2026).entries[0].viewings.length, 0);
});
test('deleting a yearly entry removes only its viewing history', () => {
  const state = empty();
  const a = addEntry(state, 2026, movie).entry;
  const b = addEntry(state, 2027, movie).entry;
  addViewing(state, a._id, '2026-10-31');
  addViewing(state, b._id, '2027-10-31');
  removeEntry(state, a._id);
  assert.equal(state.movies.length, 1);
  assert.equal(state.yearEntries.length, 1);
  assert.equal(state.viewings[0].yearEntryId, b._id);
  assert.throws(() => addViewing(state, a._id, '2026-10-31'));
});
test('calendar validation handles leap years and rejects invalid / cross-year dates', () => {
  assert.equal(validDate('2024-02-29'), true);
  for (const value of ['2026-02-29', '2026-02-31', '2026-13-01', '2026-1-01', '', null])
    assert.equal(validDate(value), false);
  const state = empty();
  const entry = addEntry(state, 2026, movie).entry;
  assert.throws(() => addViewing(state, entry._id, '2027-10-31'), /2026/);
  assert.throws(() => addViewing(state, entry._id, '2026-02-30'));
  for (const value of ['', '2026x', '2026.5', {}, 9999]) assert.throws(() => parseYear(value));
});
test('local storage persists concurrent writes and survives a new store instance', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'commune-test-'));
  try {
    const file = join(dir, 'demo.json');
    const store = createLocalStore(file);
    await Promise.all(
      Array.from({ length: 12 }, (_, i) =>
        store.mutate((state) => addEntry(state, 2050, { ...movie, tmdbId: 50000 + i }))
      )
    );
    const state = await createLocalStore(file).read();
    assert.equal(projectCollection(state, 2050).entries.length, 12);
    await assert.rejects(store.mutate((state) => addViewing(state, 'missing', '2050-10-31')));
    await store.mutate((state) =>
      addViewing(state, state.yearEntries.find((e) => e.year === 2050)._id, '2050-10-31')
    );
    assert.equal((await store.read()).viewings.length, 1);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
