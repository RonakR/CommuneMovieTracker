import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { COOKIE, validSession } from '$lib/server/delete-session.js';
export async function handle({ event, resolve }) {
  if (!['GET', 'HEAD', 'OPTIONS'].includes(event.request.method)) {
    const origin = event.request.headers.get('origin');
    if (origin !== event.url.origin)
      return json({ message: 'Please make changes from the app itself.' }, { status: 403 });
  }
  if (event.request.method === 'DELETE' && !validSession(event.cookies.get(COOKIE), env.PASSWORD)) {
    return json(
      { message: 'Enter the password to unlock deletions for this session.' },
      { status: 401 }
    );
  }
  const response = await resolve(event);
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  return response;
}
