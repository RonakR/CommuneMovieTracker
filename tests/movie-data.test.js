import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeMovie, moviePreview } from '../src/lib/server/movie-data.js';

test('details keep cast billing order while search previews exclude cast and synopsis', () => {
  const movie = normalizeMovie({
    id: 123,
    title: 'Example',
    genres: [{ name: 'Horror' }],
    credits: {
      cast: [
        { name: 'Fourth', order: 3 },
        { name: 'First', order: 0, character: 'Lead' },
        { name: 'Third', order: 2 },
        { name: 'Second', order: 1 }
      ]
    },
    vote_average: 7.25,
    vote_count: 10
  });
  assert.deepEqual(
    movie.cast.map((actor) => actor.name),
    ['First', 'Second', 'Third', 'Fourth']
  );
  const preview = moviePreview(movie);
  assert.equal('cast' in preview, false);
  assert.equal('overview' in preview, false);
  assert.equal(preview.rating, 7.25);
  assert.deepEqual(preview.genres, ['Horror']);
  assert.equal(movie.rating, 7.25);
  assert.equal(movie.voteCount, 10);
});
test('absent metadata and zero-vote ratings are represented as unavailable', () => {
  const movie = normalizeMovie({ id: 1, title: 'Unknown', vote_average: 0, vote_count: 0 });
  assert.equal(movie.rating, null);
  assert.equal(movie.runtimeMinutes, null);
  assert.equal(movie.overview, '');
  assert.deepEqual(movie.cast, []);
  assert.deepEqual(movie.genres, []);
});
