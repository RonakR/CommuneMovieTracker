import { test } from 'node:test';
import assert from 'node:assert/strict';
import { matchesPassword, createSession, validSession } from '../src/lib/server/delete-session.js';
test('password validation fails closed and compares exact input', () => {
  assert.equal(matchesPassword('secret', 'secret'), true);
  for (const input of ['', 'wrong', null, {}, 'secret '])
    assert.equal(matchesPassword(input, 'secret'), false);
  assert.equal(matchesPassword('', ''), false);
});
test('signed sessions reject tampering, expiration, and password rotation', () => {
  const token = createSession('secret', 1000);
  assert.equal(validSession(token, 'secret', 1001), true);
  assert.equal(validSession(token + 'x', 'secret', 1001), false);
  assert.equal(validSession(token, 'changed', 1001), false);
  assert.equal(validSession(token, '', 1001), false);
  assert.equal(validSession(token, 'secret', 1000 + 12 * 60 * 60 * 1000), false);
  assert.equal(validSession('bad.token', 'secret', 1001), false);
});
