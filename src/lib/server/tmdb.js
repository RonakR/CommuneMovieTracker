import { env } from '$env/dynamic/private';
import { AppError } from './domain.js';
import { catalog } from './catalog.js';
import { normalizeMovie, moviePreview } from './movie-data.js';
import { database } from './db.js';
import { createGenreCache } from './genre-cache.js';
export const isDemo = () => env.DEMO_MODE === 'true';
const detailsCache = new Map();
const inFlight = new Map();
const CACHE_MS = 60 * 60 * 1000;
const CACHE_SIZE = 200;
const getGenres = createGenreCache({
  read: async () => {
    const { db } = await database();
    return db.collection('metadata').findOne({ _id: 'tmdb-movie-genres-en-US' });
  },
  write: async (value) => {
    const { db } = await database();
    await db
      .collection('metadata')
      .updateOne({ _id: 'tmdb-movie-genres-en-US' }, { $set: value }, { upsert: true });
  },
  fetchGenres: async () => (await request('genre/movie/list', { language: 'en-US' })).genres
});
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
  const [response, genres] = await Promise.all([
    request('search/movie', { query: query.trim(), include_adult: false, language: 'en-US' }),
    getGenres()
  ]);
  const names = new Map(genres.map((genre) => [genre.id, genre.name]));
  return response.results.slice(0, 20).map((movie) =>
    moviePreview({
      ...normalizeMovie(movie),
      genres: (movie.genre_ids || []).map((id) => names.get(id)).filter(Boolean)
    })
  );
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
