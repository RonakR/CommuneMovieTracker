const DAY = 24 * 60 * 60 * 1000;
const RETRY_DELAY = 5 * 60 * 1000;

// Database-backed so a Render cold start reuses the last successful genre fetch.
export function createGenreCache({ read, write, fetchGenres, now = Date.now }) {
  let saved;
  let pending;
  let retryAfter = 0;
  return async function getGenres() {
    if (saved && now() - new Date(saved.fetchedAt).valueOf() < DAY) return saved.genres;
    if (now() < retryAfter) return saved?.genres || [];
    if (pending) return pending;
    pending = (async () => {
      try {
        if (!saved) saved = await read();
        const cutoff = new Date(now());
        cutoff.setMonth(cutoff.getMonth() - 6);
        if (saved && new Date(saved.fetchedAt) <= cutoff) saved = null;
        if (saved && now() - new Date(saved.fetchedAt).valueOf() < DAY) return saved.genres;
        const genres = await fetchGenres();
        if (
          !Array.isArray(genres) ||
          !genres.length ||
          genres.some((g) => !Number.isInteger(g.id) || typeof g.name !== 'string')
        )
          throw new Error('Invalid genre list');
        const fresh = { genres, fetchedAt: new Date(now()).toISOString() };
        await write(fresh);
        saved = fresh;
        return genres;
      } catch {
        retryAfter = now() + RETRY_DELAY;
        return saved?.genres || [];
      }
    })().finally(() => {
      pending = null;
    });
    return pending;
  };
}
