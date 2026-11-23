import { afterEach, test } from 'node:test';
import assert from 'node:assert/strict';
import worker from '../supabase/functions/device-sessions/session.mjs';
import proxy from '../deployment/device-session-worker.mjs';
import { rememberedOwnerClient } from '../device-client.js';

const env = {
  SITE_ORIGIN: 'https://profile.example.test',
  SUPABASE_URL: 'https://auth.example.test',
  SUPABASE_PUBLISHABLE_KEY: 'public-fixture',
  SUPABASE_SERVICE_ROLE_KEY: 'server-fixture',
  DEVICE_ENCRYPTION_KEY: Buffer.alloc(32, 47).toString('base64')
};
const owner = '5922fd59-f07a-4ec9-8939-abc615b7c640';
const email = 'mqmrpc@gmail.com';
const upstreamUser = { id: owner, email, app_metadata: { role: 'admin' } };
const originalFetch = globalThis.fetch;
const now = Math.floor(Date.now() / 1000);

function accessToken({ expiration = now + 1200, totp = now, aal = 'aal2', session = 'mock-session' } = {}) {
  const claims = { sub: owner, email, app_metadata: { role: 'admin' }, exp: expiration, aal, session_id: session,
    amr: [{ method: 'password', timestamp: now }, { method: 'totp', timestamp: totp }] };
  return 'fixture.' + Buffer.from(JSON.stringify(claims)).toString('base64url') + '.fixture';
}

afterEach(() => { globalThis.fetch = originalFetch; });

test('remembered Inbox opens with the authenticated first page in one request', async () => {
  const requests = [];
  const firstPage = { messages: [{ id: 'sample' }], next: null };
  globalThis.fetch = async (url, input) => {
    requests.push(url);
    assert.equal(input.credentials, 'same-origin');
    assert.deepEqual(JSON.parse(input.body), { action: 'list', folder: 'INBOX' });
    return Response.json(firstPage);
  };
  const client = await rememberedOwnerClient({ preloadInbox: true });
  assert.equal(client.remembered, true);
  assert.deepEqual(client.initialInbox, firstPage);
  assert.deepEqual(requests, ['api/device-session/mail']);
});

test('Inbox rejects expired remembered access and can recover from a mailbox service interruption', async () => {
  globalThis.fetch = async () => Response.json({ error: 'Sign in' }, { status: 401 });
  assert.equal(await rememberedOwnerClient({ preloadInbox: true }), null);
  const requests = [];
  globalThis.fetch = async url => {
    requests.push(url);
    return url.endsWith('/status')
      ? Response.json({ remembered: true })
      : Response.json({ error: 'Service unavailable' }, { status: 503 });
  };
  const client = await rememberedOwnerClient({ preloadInbox: true });
  assert.equal(client.remembered, true);
  assert.equal(client.initialInbox, undefined);
  assert.deepEqual(requests, ['api/device-session/mail', 'api/device-session/status']);
});

test('same-origin proxy forwards only the private session cookie and preserves its flags', async () => {
  const cookie = '__Host-mqr-device=; Max-Age=0; Path=/; Secure; HttpOnly; SameSite=Strict';
  globalThis.fetch = async (url, input) => {
    assert.match(url, /\/functions\/v1\/device-sessions\/lock$/);
    assert.equal(input.redirect, 'manual');
    assert.equal(input.headers.get('cookie'), '__Host-mqr-device=fixture');
    assert.equal(await new Response(input.body).text(), '{}');
    const headers = new Headers();
    headers.append('Set-Cookie', '__other=unrelated; Path=/');
    headers.append('Set-Cookie', cookie);
    return Response.json({ locked: true }, { headers });
  };
  const result = await proxy.fetch(new Request('https://mqmr.bio/api/device-session/lock', {
    method: 'POST', body: '{}', headers: { Cookie: 'other=private; __Host-mqr-device=fixture' }
  }));
  assert.equal(result.status, 200);
  assert.equal(result.headers.get('set-cookie'), cookie);
  assert.equal(result.headers.get('cache-control'), 'no-store');
});

test('same-origin proxy rejects redirects without forwarding their destination', async () => {
  globalThis.fetch = async () => Response.redirect('https://unrelated.example.test/', 307);
  const result = await proxy.fetch(new Request('https://mqmr.bio/api/device-session/status'));
  assert.equal(result.status, 502);
  assert.equal(result.headers.get('location'), null);
});

test('remembered devices require MFA, encrypt tokens, proxy authorized mail, and revoke access', async () => {
  const rows = new Map();
  const ownerToken = accessToken();
  const nearExpiryToken = accessToken({ expiration: now + 15 });
  const refreshedToken = accessToken({ totp: now - 900 });
  const oldToken = accessToken({ totp: now - 900, session: 'old-sign-in' });
  const passwordToken = accessToken({ aal: 'aal1' });
  const pending = [];
  let refreshCount = 0;
  let acceptedMail = 0;
  let profileRevision = 8;
  globalThis.fetch = async (target, request) => {
    const url = new URL(target);
    assert.equal(url.origin, env.SUPABASE_URL);
    const body = request.body && JSON.parse(request.body);
    const token = request.headers.Authorization;
    if (url.pathname === '/auth/v1/user') {
      return [ownerToken, oldToken, passwordToken].some(value => token === 'Bearer ' + value)
        ? Response.json(upstreamUser) : Response.json({}, { status: 401 });
    }
    if (url.pathname === '/auth/v1/token') {
      refreshCount++;
      assert.equal(token, undefined);
      const sessions = {
        'first-refresh': { access_token: nearExpiryToken, refresh_token: 'rotated-refresh' },
        'rotated-refresh': { access_token: refreshedToken, refresh_token: 'latest-refresh' },
        'unrelated-refresh': { access_token: accessToken({ session: 'unrelated' }), refresh_token: 'unrelated-rotated' }
      };
      return Response.json(sessions[body.refresh_token] || {}, { status: sessions[body.refresh_token] ? 200 : 400 });
    }
    if (url.pathname === '/functions/v1/mail-domain') {
      assert.equal(token, 'Bearer ' + refreshedToken);
      assert.deepEqual(body, { action: 'list', folder: 'INBOX' });
      acceptedMail++;
      return Response.json({ messages: [] });
    }
    if (url.pathname === '/rest/v1/profile_homepage') {
      assert.equal(token, 'Bearer ' + refreshedToken);
      assert.deepEqual(body, { payload: { showSemicolon: false } });
      assert.equal(request.method, 'PATCH');
      return Response.json(url.searchParams.get('revision') === 'eq.' + profileRevision
        ? [{ revision: ++profileRevision }] : []);
    }
    assert.equal(url.pathname, '/rest/v1/device_sessions');
    assert.equal(token, 'Bearer server-fixture');
    if (request.method === 'POST') {
      const row = { ...body, id: crypto.randomUUID(), credential_version: crypto.randomUUID(),
        last_seen_at: new Date().toISOString(), refresh_until: null };
      rows.set(row.id, row);
      return Response.json([row]);
    }
    const select = url.searchParams.get('select')?.split(',');
    const matching = [...rows.values()].filter(row =>
      [...url.searchParams].every(([key, filter]) => {
        if (key === 'or') return !row.refresh_until || Date.parse(row.refresh_until) < Date.now();
        if (filter.startsWith('eq.')) return String(row[key]) === filter.slice(3);
        if (filter.startsWith('gt.')) return Date.parse(row[key]) > Date.parse(filter.slice(3));
        if (filter.startsWith('lte.')) return Date.parse(row[key]) <= Date.parse(filter.slice(4));
        return true;
      })
    );
    if (request.method === 'PATCH') matching.forEach(row => Object.assign(row, body));
    if (request.method === 'DELETE') matching.forEach(row => rows.delete(row.id));
    return Response.json(select
      ? matching.map(row => Object.fromEntries(select.map(key => [key, row[key]])))
      : matching);
  };

  function hit(route, { cookie, token, body, origin = env.SITE_ORIGIN } = {}) {
    const headers = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0) Chrome/130.0' };
    if (cookie) headers.Cookie = cookie;
    if (token) headers.Authorization = 'Bearer ' + token;
    if (body !== undefined) Object.assign(headers, { Origin: origin, 'Content-Type': 'application/json' });
    return worker.fetch(new Request(env.SITE_ORIGIN + '/api/device-session/' + route, {
      headers, method: body === undefined ? 'GET' : 'POST', body: JSON.stringify(body)
    }), env, { waitUntil: task => pending.push(task) });
  }

  assert.equal((await hit('status')).status, 401);
  assert.equal((await hit('capability')).status, 200);
  assert.equal((await hit('remember', { token: ownerToken, body: {}, origin: 'https://elsewhere.example.test' })).status, 403);
  assert.equal((await hit('remember', { token: passwordToken, body: { refreshToken: 'first-refresh' } })).status, 403);
  assert.equal((await hit('remember', { token: oldToken, body: { refreshToken: 'first-refresh' } })).status, 403);
  assert.equal(refreshCount, 0);
  assert.equal((await hit('remember', { token: ownerToken, body: { refreshToken: 'unrelated-refresh' } })).status, 403);
  const response = await hit('remember', { token: ownerToken, body: { refreshToken: 'first-refresh' } });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { remembered: true });
  const setCookie = response.headers.get('Set-Cookie');
  assert.match(setCookie, /^__Host-mqr-device=[\w-]{43}; Max-Age=1209600; Path=\/; Secure; HttpOnly; SameSite=Strict$/);
  const cookie = setCookie.split(';')[0];
  const [row] = rows.values();
  assert.match(row.cookie_hash, /^[0-9a-f]{64}$/);
  assert.ok(!JSON.stringify(row).includes(cookie.split('=')[1]));
  assert.ok(!JSON.stringify(row).includes('rotated-refresh'));
  assert.equal(row.label, 'Chrome · Windows');

  const concurrent = await Promise.all([hit('status', { cookie }), hit('status', { cookie })]);
  assert.deepEqual(concurrent.map(result => result.status), [200, 200]);
  assert.equal(refreshCount, 3);
  const listing = await hit('devices', { cookie });
  const { devices: [device] } = await listing.json();
  assert.deepEqual(Object.keys(device).sort(), ['current', 'expires_at', 'id', 'label', 'last_seen_at']);
  assert.equal(device.current, true);
  assert.equal((await hit('mail', { cookie, body: { action: 'list', folder: 'INBOX' } })).status, 200);
  const profile = { revision: 8, payload: { showSemicolon: false } };
  assert.equal((await hit('profile', { body: profile })).status, 401);
  assert.deepEqual(await (await hit('profile', { cookie, body: profile })).json(), { revision: 9 });
  assert.equal((await hit('profile', { cookie, body: profile })).status, 409);
  assert.equal((await hit('revoke', { cookie, body: { id: row.id } })).status, 403);
  const removed = await hit('revoke', { cookie, token: ownerToken, body: { id: row.id } });
  assert.equal(removed.status, 200);
  assert.match(removed.headers.get('Set-Cookie'), /Max-Age=0/);
  assert.equal((await hit('mail', { cookie, body: { action: 'list', folder: 'INBOX' } })).status, 401);
  assert.equal(acceptedMail, 1);

  const again = await hit('remember', { token: ownerToken, body: { refreshToken: 'first-refresh' } });
  const secondCookie = again.headers.get('Set-Cookie').split(';')[0];
  const [expired] = rows.values();
  expired.expires_at = new Date(Date.now() - 1000).toISOString();
  assert.equal((await hit('status', { cookie: secondCookie })).status, 401);
  assert.equal((await hit('lock', { cookie: secondCookie, body: {} })).status, 200);
  await Promise.all(pending);
  assert.equal(rows.size, 0);
});
