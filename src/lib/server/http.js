import { json } from '@sveltejs/kit';
import { AppError } from './domain.js';
export async function respond(fn) {
  try {
    return json((await fn()) ?? { ok: true });
  } catch (error) {
    if (error instanceof AppError)
      return json({ message: error.message }, { status: error.status });
    // Never expose connection strings or upstream errors to the browser/logs.
    return json(
      { message: 'Something went wrong saving your changes. Please retry.' },
      { status: 500 }
    );
  }
}
export async function body(request) {
  const text = await request.text();
  if (text.length > 4096) throw new AppError('Request is too large.', 413);
  try {
    const value = JSON.parse(text);
    if (!value || Array.isArray(value) || typeof value !== 'object') throw new Error();
    return value;
  } catch {
    throw new AppError('Invalid request.');
  }
}
