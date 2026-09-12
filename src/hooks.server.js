import { json } from '@sveltejs/kit';
export async function handle({ event, resolve }) {
  if (!['GET', 'HEAD', 'OPTIONS'].includes(event.request.method)) {
    const origin = event.request.headers.get('origin');
    if (origin !== event.url.origin)
      return json({ message: 'Please make changes from the app itself.' }, { status: 403 });
  }
  const response = await resolve(event);
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  return response;
}
