import { createEntry } from '$lib/server/repository.js';
import { respond, body } from '$lib/server/http.js';
export const POST = ({ request }) =>
  respond(async () => {
    const data = await body(request);
    return createEntry(data.year, data.tmdbId);
  });
