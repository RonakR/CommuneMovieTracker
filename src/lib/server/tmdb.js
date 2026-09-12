import { env } from '$env/dynamic/private';
import { AppError } from './domain.js';
import { catalog } from './catalog.js';
import { normalizeMovie, moviePreview } from './movie-data.js';
export const isDemo = () => env.DEMO_MODE === 'true';
const detailsCache = new Map();
const inFlight = new Map();
const CACHE_MS = 60 * 60 * 1000;
const CACHE_SIZE = 200;
async function request(path, params = {}) {
  if (!env.TMDB_READ_ACCESS_TOKEN)
    throw new AppError('Add your TMDB read access token to .env and restart the server.', 503);
  const url = new URL(`https://api.themoviedb.org/3/${path}`);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, String(value));
  let response;
  try {
    response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${env.TMDB_READ_ACCESS_TOKEN}`,
        Accept: 'application/json'
      },
      signal: AbortSignal.timeout(10000)
    });
  } catch {
    throw new AppError('TMDB could not be reached. Try again in a moment.', 502);
  }
  if (!response.ok)
    throw new AppError(
      response.status === 401
        ? 'TMDB rejected the token. Check .env and restart the server.'
        : 'TMDB is temporarily unavailable. Please try again.',
      502
    );
  return response.json();
}
export async function searchMovies(query) {
  if (typeof query !== 'string' || query.trim().length < 2) return [];
  if (query.length > 150) throw new AppError('Keep your search under 150 characters.');
  if (isDemo())
    return catalog
      .filter((m) => m.title.toLowerCase().includes(query.toLowerCase().trim()))
      .map(moviePreview);
  const response = await request('search/movie', {
    query: query.trim(),
    include_adult: false,
    language: 'en-US'
  });
  const movies = response.results.slice(0, 20);
  const results = new Array(movies.length);
  let next = 0;
  // Search doesn't include cast. Limit enrichment to four concurrent detail requests.
  await Promise.all(
    Array.from({ length: Math.min(4, movies.length) }, async () => {
      while (next < movies.length) {
        const index = next++;
        try {
          results[index] = moviePreview(await getMovieDetails(movies[index].id));
        } catch {
          results[index] = moviePreview({
            ...normalizeMovie(movies[index]),
            detailsUnavailable: true
          });
        }
      }
    })
  );
  return results;
}
export async function getMovieDetails(id) {
  if (!/^\d+$/.test(String(id)) || !Number.isSafeInteger(Number(id)) || Number(id) <= 0)
    throw new AppError('Choose a valid movie.');
  id = Number(id);
  if (isDemo()) {
    const movie = catalog.find((m) => m.tmdbId === id);
    if (!movie) throw new AppError('Movie not found in the demo catalog.', 404);
    return { ...movie };
  }
  const cached = detailsCache.get(id);
  if (cached && cached.expires > Date.now()) return cached.movie;
  detailsCache.delete(id);
  if (inFlight.has(id)) return inFlight.get(id);
  const pending = request(`movie/${id}`, { language: 'en-US', append_to_response: 'credits' })
    .then((response) => {
      const movie = normalizeMovie(response);
      if (detailsCache.size >= CACHE_SIZE) detailsCache.delete(detailsCache.keys().next().value);
      detailsCache.set(id, { movie, expires: Date.now() + CACHE_MS });
      return movie;
    })
    .finally(() => inFlight.delete(id));
  inFlight.set(id, pending);
  return pending;
}
export async function getMovie(id) {
  const { tmdbId, title, releaseDate, posterPath, runtimeMinutes, artwork, tagline } =
    await getMovieDetails(id);
  // Persist only the small metadata snapshot; search/details use the short-lived cache.
  return {
    tmdbId,
    title,
    releaseDate,
    posterPath,
    runtimeMinutes,
    ...(isDemo() ? { artwork, tagline } : {})
  };
}
