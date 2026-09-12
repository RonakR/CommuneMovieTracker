import { getMovieDetails } from '$lib/server/tmdb.js';
import { respond } from '$lib/server/http.js';
export const GET = ({ params }) =>
  respond(async () => ({ movie: await getMovieDetails(params.id) }));
