import { deleteEntry } from '$lib/server/repository.js';
import { respond } from '$lib/server/http.js';
export const DELETE = ({ params }) => respond(() => deleteEntry(params.id));
