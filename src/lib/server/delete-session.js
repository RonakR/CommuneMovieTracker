import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

export const COOKIE = 'delete_session';
const LIFETIME = 12 * 60 * 60 * 1000;
const digest = (value) => createHash('sha256').update(value).digest();
export function matchesPassword(value, password) {
  return (
    Boolean(password && typeof value === 'string') &&
    timingSafeEqual(digest(value), digest(password))
  );
}
const sign = (value, password) =>
  createHmac('sha256', password).update(`delete-session:${value}`).digest('base64url');
export function createSession(password, now = Date.now()) {
  const value = `${now + LIFETIME}.${randomBytes(16).toString('hex')}`;
  return `${value}.${sign(value, password)}`;
}
export function validSession(token, password, now = Date.now()) {
  if (!password || typeof token !== 'string') return false;
  const parts = token.split('.');
  if (parts.length !== 3) return false;
  const [expiry, nonce, signature] = parts;
  const expires = Number(expiry);
  if (!Number.isFinite(expires) || expires <= now || expires > now + LIFETIME) return false;
  return timingSafeEqual(digest(signature), digest(sign(`${expiry}.${nonce}`, password)));
}
