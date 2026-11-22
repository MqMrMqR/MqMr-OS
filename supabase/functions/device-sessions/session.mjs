const owner = '5922fd59-f07a-4ec9-8939-abc615b7c640';
const email = 'mqmrpc@gmail.com';
const prefix = '/api/device-session/';
const cookieName = '__Host-mqr-device';
const lifetime = 14 * 24 * 60 * 60;
const encoder = new TextEncoder();
const decoder = new TextDecoder();
const mailActions = new Set(['list', 'read', 'modify', 'addresses', 'add-address', 'send', 'attachment']);

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function json(data, status = 200, headers = {}) {
  return Response.json(data, { status, headers: {
    'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...headers
  } });
}

function cookie(value, age) {
  return cookieName + '=' + value + '; Max-Age=' + age + '; Path=/; Secure; HttpOnly; SameSite=Strict';
}

function base64(bytes) {
  return btoa(String.fromCharCode(...bytes));
}

function bytes(value) {
  return Uint8Array.from(atob(value.replace(/-/g, '+').replace(/_/g, '/')), char => char.charCodeAt(0));
}

async function cookieHash(value) {
  const hash = await crypto.subtle.digest('SHA-256', encoder.encode(value));
  return Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, '0')).join('');
}

async function credentialKey(env) {
  const key = bytes(env.DEVICE_ENCRYPTION_KEY);
  if (key.length !== 32) throw new Error('Invalid encryption key length.');
  return crypto.subtle.importKey('raw', key, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

async function seal(session, hash, env) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: encoder.encode(hash) },
    await credentialKey(env), encoder.encode(JSON.stringify(session))
  );
  return base64(iv) + '.' + base64(new Uint8Array(encrypted));
}

async function unseal(row, env) {
  const [iv, encrypted] = row.credentials.split('.');
  const result = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: bytes(iv), additionalData: encoder.encode(row.cookie_hash) },
    await credentialKey(env), bytes(encrypted)
  );
  return JSON.parse(decoder.decode(result));
}

async function upstream(env, path, { key = env.SUPABASE_PUBLISHABLE_KEY, token, method, body, prefer } = {}) {
  const headers = { apikey: key };
  if (token) headers.Authorization = 'Bearer ' + token;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (prefer) headers.Prefer = prefer;
  return fetch(env.SUPABASE_URL + path, {
    method, headers, body: body === undefined ? undefined : JSON.stringify(body),
    redirect: 'error', signal: AbortSignal.timeout(path.startsWith('/auth/') ? 5500 : 25000)
  });
}

async function table(env, filters, method, body) {
  const query = new URLSearchParams(filters);
  const response = await upstream(env, '/rest/v1/device_sessions?' + query, {
    key: env.SUPABASE_SERVICE_ROLE_KEY, token: env.SUPABASE_SERVICE_ROLE_KEY, method, body,
    prefer: method ? 'return=representation' : undefined
  });
  if (!response.ok) throw new HttpError(503, 'Device sessions are temporarily unavailable.');
  return response.json();
}

function claimsFor(token, recent) {
  try {
    const claims = JSON.parse(decoder.decode(bytes(token.split('.')[1])));
    const now = Date.now() / 1000;
    const totp = claims.amr?.find(entry => entry.method === 'totp');
    if (claims.sub === owner && claims.email === email && claims.app_metadata?.role === 'admin' &&
        claims.aal === 'aal2' && claims.amr.some(entry => entry.method === 'password') && totp &&
        claims.exp > now && typeof claims.session_id === 'string' &&
        (!recent || (totp.timestamp >= now - 300 && totp.timestamp <= now + 30))) return claims;
  } catch {}
  return null;
}

async function verifyBearer(token, env, recent = false) {
  const claims = claimsFor(token, recent);
  if (!claims) return null;
  const response = await upstream(env, '/auth/v1/user', { token });
  if (response.status >= 500 || response.status === 429) throw new HttpError(503, 'Verification is temporarily unavailable.');
  if (!response.ok) return null;
  const user = await response.json();
  return user.id === owner && user.email === email && user.app_metadata?.role === 'admin' ? claims : null;
}

async function refresh(token, env) {
  const response = await upstream(env, '/auth/v1/token?grant_type=refresh_token', {
    method: 'POST', body: { refresh_token: token }
  });
  if (response.status >= 500 || response.status === 429) throw new HttpError(503, 'Verification is temporarily unavailable.');
  if (!response.ok) return null;
  const { access_token, refresh_token } = await response.json();
  return typeof refresh_token === 'string' && claimsFor(access_token) ? { access_token, refresh_token } : null;
}

function labelFor(agent) {
  const browser = /Edg\//.test(agent) ? 'Edge' : /Firefox\//.test(agent) ? 'Firefox' :
    /Chrom(e|ium)\//.test(agent) ? 'Chrome' : /Safari\//.test(agent) ? 'Safari' : 'Browser';
  const system = /iPad|iPhone/.test(agent) ? 'iOS' : /Android/.test(agent) ? 'Android' :
    /Windows/.test(agent) ? 'Windows' : /Macintosh/.test(agent) ? 'macOS' : /Linux/.test(agent) ? 'Linux' : '';
  return system ? browser + ' · ' + system : browser;
}

async function findDevice(env, hash) {
  if (!hash) return null;
  const [row] = await table(env, { cookie_hash: 'eq.' + hash, expires_at: 'gt.' + new Date().toISOString() });
  return row;
}

async function activeToken(row, env) {
  const session = await unseal(row, env);
  const claims = claimsFor(session.access_token);
  if (claims?.exp > Date.now() / 1000 + 30) return session.access_token;

  // The refresh-token rotation is shared across tabs and isolates.
  const now = new Date();
  const until = new Date(now.getTime() + 10000).toISOString();
  const identity = { id: 'eq.' + row.id, credential_version: 'eq.' + row.credential_version };
  const [leased] = await table(env, {
    ...identity, or: '(refresh_until.is.null,refresh_until.lt.' + now.toISOString() + ')'
  }, 'PATCH', { refresh_until: until });
  if (!leased) {
    for (let attempt = 0; attempt < 5; attempt++) {
      await new Promise(resolve => setTimeout(resolve, 200));
      const latest = await findDevice(env, row.cookie_hash);
      if (!latest) return null;
      if (latest.credential_version !== row.credential_version) {
        const current = await unseal(latest, env);
        return claimsFor(current.access_token) ? current.access_token : null;
      }
    }
    throw new HttpError(503, 'Session is refreshing. Try again.');
  }

  const lease = { ...identity, refresh_until: 'eq.' + until };
  try {
    const next = await refresh(session.refresh_token, env);
    if (!next || claimsFor(next.access_token).session_id !== session.session_id) {
      await table(env, lease, 'DELETE');
      return null;
    }
    const [saved] = await table(env, lease, 'PATCH', {
      credentials: await seal({ ...next, session_id: session.session_id }, row.cookie_hash, env),
      credential_version: crypto.randomUUID(), refresh_until: null
    });
    return saved ? next.access_token : null;
  } catch (error) {
    await table(env, lease, 'PATCH', { refresh_until: null }).catch(() => {});
    throw error;
  }
}

async function input(request, limit = 16384) {
  if (!request.headers.get('Content-Type')?.startsWith('application/json')) {
    throw new HttpError(415, 'JSON is required.');
  }
  const reader = request.body?.getReader();
  if (!reader) throw new HttpError(400, 'Missing request body.');
  let size = 0;
  let raw = '';
  const bodyDecoder = new TextDecoder();
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) {
        await reader.cancel();
        throw new HttpError(413, 'Request is too large.');
      }
      raw += bodyDecoder.decode(value, { stream: true });
    }
    const body = JSON.parse(raw + bodyDecoder.decode());
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error();
    return body;
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(400, 'Invalid request body.');
  }
}

async function saveProfile(request, env, token) {
  const { payload, revision } = await input(request, 128000);
  if (!payload || Array.isArray(payload) || typeof payload !== 'object' ||
      (revision !== null && (!Number.isSafeInteger(revision) || revision < 1))) {
    throw new HttpError(400, 'Invalid profile revision or content.');
  }
  const insert = revision === null;
  const response = await upstream(env, '/rest/v1/profile_homepage?select=revision' +
    (insert ? '' : '&singleton=eq.true&revision=eq.' + revision), {
    method: insert ? 'POST' : 'PATCH', token, prefer: 'return=representation',
    body: insert ? { singleton: true, payload } : { payload }
  });
  if (response.status === 409) throw new HttpError(409, 'The profile changed in another tab. Review the latest version before saving again.');
  if (!response.ok) throw new HttpError(502, 'Could not publish this profile.');
  const [stored] = await response.json();
  if (!stored) throw new HttpError(409, 'The profile changed in another tab. Review the latest version before saving again.');
  return json(stored);
}

const allowedMethods = {
  capability: 'GET', status: 'GET', devices: 'GET', remember: 'POST', revoke: 'POST',
  lock: 'POST', mail: 'POST', profile: 'POST'
};

async function handle(request, env, context) {
  const url = new URL(request.url);
  if (url.origin !== env.SITE_ORIGIN || !url.pathname.startsWith(prefix)) return json({ error: 'Not found.' }, 404);
  const route = url.pathname.slice(prefix.length);
  if (!Object.hasOwn(allowedMethods, route)) return json({ error: 'Not found.' }, 404);
  if (request.method !== allowedMethods[route]) return json({ error: 'Method not allowed.' }, 405);
  if (request.method === 'POST' && (request.headers.get('Origin') !== env.SITE_ORIGIN ||
      (request.headers.has('Sec-Fetch-Site') && request.headers.get('Sec-Fetch-Site') !== 'same-origin'))) {
    return json({ error: 'Invalid origin.' }, 403);
  }
  if (route === 'capability') {
    if (!env.SUPABASE_URL || !env.SUPABASE_PUBLISHABLE_KEY || !env.SUPABASE_SERVICE_ROLE_KEY) {
      return json({ error: 'Unavailable.' }, 503);
    }
    await credentialKey(env);
    return json({ rememberDevice: true });
  }
  const value = request.headers.get('Cookie')?.match(/(?:^|;\s*)__Host-mqr-device=([A-Za-z0-9_-]{43})(?:;|$)/)?.[1];
  const hash = value ? await cookieHash(value) : null;
  if (route === 'lock') {
    if (hash) await table(env, { cookie_hash: 'eq.' + hash }, 'DELETE');
    return json({ locked: true }, 200, { 'Set-Cookie': cookie('', 0) });
  }
  const bearer = request.headers.get('Authorization')?.match(/^Bearer ([A-Za-z0-9._-]+)$/)?.[1];
  if (route === 'remember') {
    const claims = bearer && await verifyBearer(bearer, env, true);
    if (!claims) throw new HttpError(403, 'Verify your password and authenticator again to remember this device.');
    const { refreshToken } = await input(request);
    if (typeof refreshToken !== 'string' || !refreshToken) throw new HttpError(400, 'Missing session.');
    const session = await refresh(refreshToken, env);
    if (!session || claimsFor(session.access_token).session_id !== claims.session_id) {
      throw new HttpError(403, 'The sign-in session could not be verified.');
    }
    const key = base64(crypto.getRandomValues(new Uint8Array(32))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    const digest = await cookieHash(key);
    await table(env, {}, 'POST', {
      cookie_hash: digest,
      credentials: await seal({ ...session, session_id: claims.session_id }, digest, env),
      label: labelFor(request.headers.get('User-Agent') || ''),
      expires_at: new Date(Date.now() + lifetime * 1000).toISOString()
    });
    context.waitUntil(table(env, { expires_at: 'lte.' + new Date().toISOString() }, 'DELETE').catch(() => {}));
    if (hash) await table(env, { cookie_hash: 'eq.' + hash }, 'DELETE');
    return json({ remembered: true }, 200, { 'Set-Cookie': cookie(key, lifetime) });
  }

  const row = await findDevice(env, hash);
  const direct = bearer && (route === 'devices' || route === 'revoke') && await verifyBearer(bearer, env);
  const token = direct ? bearer : row && await activeToken(row, env);
  if (!token) throw new HttpError(401, 'Sign in to continue.');
  context.waitUntil((async () => {
    if (row && Date.now() - Date.parse(row.last_seen_at) > 300000) {
      await table(env, { id: 'eq.' + row.id }, 'PATCH', { last_seen_at: new Date().toISOString() });
    }
  })().catch(() => {}));

  if (route === 'status') return json({ remembered: true });
  if (route === 'devices') {
    const rows = await table(env, {
      select: 'id,label,last_seen_at,expires_at', expires_at: 'gt.' + new Date().toISOString(), order: 'last_seen_at.desc'
    });
    return json({ devices: rows.map(device => ({ ...device, current: device.id === row?.id })) });
  }
  if (route === 'revoke') {
    if (!claimsFor(token, true)) throw new HttpError(403, 'Sign in again with your authenticator to remove a device.');
    const { id } = await input(request);
    if (typeof id !== 'string' || !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(id)) {
      throw new HttpError(400, 'Invalid device.');
    }
    await table(env, { id: 'eq.' + id }, 'DELETE');
    const current = id === row?.id;
    return json({ revoked: true, current }, 200, current ? { 'Set-Cookie': cookie('', 0) } : {});
  }
  if (route === 'profile') return saveProfile(request, env, token);

  const body = await input(request, 15 * 1024 * 1024);
  if (!mailActions.has(body.action)) throw new HttpError(400, 'Unknown mail action.');
  const response = await upstream(env, '/functions/v1/mail-domain', { method: 'POST', token, body });
  return new Response(response.body, { status: response.status, headers: {
    'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff'
  } });
}

export default {
  async fetch(request, env, context) {
    try {
      return await handle(request, env, context);
    } catch (error) {
      if (error instanceof HttpError) return json({ error: error.message }, error.status);
      return json({ error: 'Device sessions are temporarily unavailable.' }, 503);
    }
  }
};
