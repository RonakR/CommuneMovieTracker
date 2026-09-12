import { updateViewing, deleteViewing } from '$lib/server/repository.js';
import { respond, body } from '$lib/server/http.js';
export const PATCH = ({ params, request }) =>
  respond(async () => {
    const data = await body(request);
    return updateViewing(params.id, data.watchedOn);
  });
export const DELETE = ({ params }) => respond(() => deleteViewing(params.id));
