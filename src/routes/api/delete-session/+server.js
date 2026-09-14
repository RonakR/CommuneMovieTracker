import { env } from '$env/dynamic/private';
import { json } from '@sveltejs/kit';
import { body, respond } from '$lib/server/http.js';
import { AppError } from '$lib/server/domain.js';
import {
  COOKIE,
  createSession,
  matchesPassword,
  validSession
} from '$lib/server/delete-session.js';

export const GET = ({ cookies }) =>
  json(
    { unlocked: validSession(cookies.get(COOKIE), env.PASSWORD) },
    { headers: { 'Cache-Control': 'no-store' } }
  );
export const POST = ({ request, cookies, url }) =>
  respond(async () => {
    if (!env.PASSWORD)
      throw new AppError('Deletion is unavailable until a password is configured.', 503);
    const data = await body(request);
    if (!matchesPassword(data.password, env.PASSWORD))
      throw new AppError('Incorrect password. Please try again.', 401);
    cookies.set(COOKIE, createSession(env.PASSWORD), {
      path: '/',
      httpOnly: true,
      secure: url.protocol === 'https:',
      sameSite: 'strict'
    });
    return { unlocked: true };
  });
