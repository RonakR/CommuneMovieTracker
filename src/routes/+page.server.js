import { collection } from '$lib/server/repository.js';
import { isDemo } from '$lib/server/tmdb.js';
import { AppError, parseYear } from '$lib/server/domain.js';
import { error } from '@sveltejs/kit';
export async function load({ url, depends }) {
  depends('app:collection');
  let year;
  try {
    year = parseYear(url.searchParams.get('year') || new Date().getFullYear());
  } catch {
    error(400, 'Choose a valid collection year (1900–2200).');
  }
  try {
    return { ...(await collection(year)), demo: isDemo(), setupError: null };
  } catch (err) {
    return {
      year,
      years: [year],
      entries: [],
      demo: isDemo(),
      setupError:
        err instanceof AppError ? err.message : 'The collection could not be loaded. Please retry.'
    };
  }
}
