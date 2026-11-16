import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { apiRequest, apiSend, onSessionExpired } from './api.js';

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });
const reply = (status, body = { message: 'Request failed.' }) => new Response(JSON.stringify(body), { status });

test('protected API 401 clears the subscribed session without another auth request', async () => {
  let user = { role: 'STUDENT' }, requests = 0;
  const unsubscribe = onSessionExpired(() => { user = null; });
  try {
    globalThis.fetch = async () => { requests++; return reply(401); };
    await assert.rejects(apiRequest('incidents/my'), { status: 401 });
    assert.equal(user, null);
    assert.equal(requests, 1);
  } finally { unsubscribe(); }
});

test('login failures, initial session checks, validation and forbidden responses do not expire a session', async () => {
  let events = 0;
  const unsubscribe = onSessionExpired(() => { events++; });
  try {
    for (const [path, status] of [['auth/login', 401], ['auth/me', 401], ['incidents', 400], ['incidents', 403], ['incidents', 409]]) {
      globalThis.fetch = async () => reply(status);
      await assert.rejects(apiRequest(path), { status });
    }
    assert.equal(events, 0);
  } finally { unsubscribe(); }
});

test('unmounted subscribers are removed and a new login can subscribe again', async () => {
  let oldEvents = 0, newEvents = 0;
  const old = onSessionExpired(() => { oldEvents++; });
  old();
  const current = onSessionExpired(() => { newEvents++; });
  try {
    globalThis.fetch = async () => reply(401);
    await assert.rejects(apiRequest('notifications'));
    assert.equal(oldEvents, 0);
    assert.equal(newEvents, 1);
  } finally { current(); }
});

test('mutations retain credentials and CSRF and propagate expiry after token retrieval', async () => {
  const calls = [];
  let expired = false;
  const unsubscribe = onSessionExpired(() => { expired = true; });
  try {
    globalThis.fetch = async (url, options) => {
      calls.push({ url, options });
      return url.endsWith('/csrf') ? reply(200, { headerName: 'X-CSRF-TOKEN', token: 'test-token' }) : reply(401);
    };
    await assert.rejects(apiSend('incidents', { title: 'Outage' }), { status: 401 });
    assert.equal(expired, true);
    assert.equal(calls.length, 2);
    assert.equal(calls[1].options.credentials, 'include');
    assert.equal(calls[1].options.headers['X-CSRF-TOKEN'], 'test-token');
    assert.equal(calls[1].options.method, 'POST');
  } finally { unsubscribe(); }
});

test('network failures do not incorrectly sign out a user', async () => {
  let expired = false;
  const unsubscribe = onSessionExpired(() => { expired = true; });
  try {
    globalThis.fetch = async () => { throw new TypeError('offline'); };
    await assert.rejects(apiRequest('incidents'), /Unable to connect/);
    assert.equal(expired, false);
  } finally { unsubscribe(); }
});
