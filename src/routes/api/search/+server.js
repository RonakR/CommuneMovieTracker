import { searchMovies } from '$lib/server/tmdb.js';
import { respond } from '$lib/server/http.js';
export const GET = ({ url }) =>
  respond(async () => ({ movies: await searchMovies(url.searchParams.get('q') || '') }));
