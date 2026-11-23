const api = 'api/device-session/';
const deviceHint = 'mqr-remembered-on-this-browser';
let availability;

export function hasRememberedHint() {
  try { return localStorage.getItem(deviceHint) === '1'; } catch { return false; }
}

function setRememberedHint(remembered) {
  try {
    if (remembered) localStorage.setItem(deviceHint, '1');
    else localStorage.removeItem(deviceHint);
  } catch {}
}

function request(route, { body, token, signal } = {}) {
  const headers = {};
  if (token) headers.Authorization = 'Bearer ' + token;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  return fetch(api + route, {
    method: body === undefined ? 'GET' : 'POST',
    headers, body: body === undefined ? undefined : JSON.stringify(body), signal, cache: 'no-store',
    credentials: 'same-origin'
  });
}

export function deviceSessionsAvailable() {
  availability ??= request('capability', { signal: AbortSignal.timeout(3500) })
    .then(async response => response.ok && (await response.json()).rememberDevice === true)
    .catch(() => false);
  return availability;
}

export async function rememberDevice(session) {
  const response = await request('remember', {
    token: session.access_token, body: { refreshToken: session.refresh_token }
  });
  const remembered = response.ok && (await response.json()).remembered === true;
  if (remembered) setRememberedHint(true);
  return remembered;
}

export async function lockRemembered() {
  const response = await request('lock', { body: {} });
  if (!response.ok && response.status !== 404 && response.status !== 405) throw new Error('Could not lock this device.');
  setRememberedHint(false);
}

export async function rememberedOwnerClient({ preloadInbox = false } = {}) {
  let initialInbox;
  if (preloadInbox) {
    const result = await request('mail', {
      body: { action: 'list', folder: 'INBOX' }, signal: AbortSignal.timeout(8000)
    }).catch(() => null);
    if (result?.status === 401 || result?.status === 404) {
      setRememberedHint(false);
      return null;
    }
    if (result?.ok) initialInbox = await result.json().catch(() => null);
  }
  if (!Array.isArray(initialInbox?.messages)) {
    initialInbox = undefined;
    const response = await request('status', { signal: AbortSignal.timeout(8000) });
    if (response.status === 401 || response.status === 404) {
      setRememberedHint(false);
      return null;
    }
    if (!response.ok) throw new Error('Could not verify this device.');
    if ((await response.json()).remembered !== true) return null;
  }
  setRememberedHint(true);

  const listeners = new Set();
  let timer, checking = false;
  const lock = () => {
    setRememberedHint(false);
    clearInterval(timer);
    document.removeEventListener('visibilitychange', check);
    listeners.forEach(listener => listener('SIGNED_OUT', null));
  };
  async function check() {
    if (checking || document.hidden) return;
    checking = true;
    try {
      const state = await request('status', { signal: AbortSignal.timeout(8000) });
      if (state.status === 401) lock();
    } catch {
      // A transient network failure should not erase the saved session.
    } finally { checking = false; }
  }
  return {
    remembered: true,
    initialInbox,
    auth: {
      onAuthStateChange: listener => {
        listeners.add(listener);
        if (!timer) {
          timer = setInterval(check, 60000);
          document.addEventListener('visibilitychange', check);
        }
      },
      signOut: async () => {
        try { await lockRemembered(); }
        catch (error) { return { error }; }
        lock();
        return { error: null };
      }
    },
    functions: {
      async invoke(_name, { body }) {
        const result = await request('mail', { body });
        if (result.status === 401) lock();
        if (!result.ok) return { error: { context: result } };
        return { data: await result.json() };
      }
    },
    async saveProfile(payload, revision) {
      const result = await request('profile', { body: { payload, revision } });
      if (result.status === 401) lock();
      const data = await result.json();
      if (!result.ok) throw new Error(data.error || 'Could not publish this profile.');
      return data.revision;
    }
  };
}

export async function manageDevices(client) {
  if (!client.remembered && !await deviceSessionsAvailable()) return;
  const panel = document.querySelector('#devices-panel');
  const list = document.querySelector('#device-list');
  const status = document.querySelector('#devices-status');
  panel.hidden = false;

  async function authToken() {
    if (client.remembered) return undefined;
    const { data } = await client.auth.getSession();
    return data.session?.access_token;
  }

  async function render() {
    status.textContent = 'Loading devices…';
    const response = await request('devices', { token: await authToken() });
    if (!response.ok) throw new Error('Could not load your saved devices.');
    const { devices } = await response.json();
    status.textContent = devices.length ? '' : 'No devices are remembered.';
    const date = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });
    list.replaceChildren(...devices.map(device => {
      const row = document.createElement('li');
      const details = document.createElement('div');
      const name = document.createElement('strong');
      const activity = document.createElement('small');
      const button = document.createElement('button');
      name.textContent = device.label + (device.current ? ' (this device)' : '');
      activity.textContent = 'Last active ' + date.format(new Date(device.last_seen_at)) +
        ' · Expires ' + date.format(new Date(device.expires_at));
      details.append(name, activity);
      button.type = 'button';
      button.textContent = 'Remove';
      button.setAttribute('aria-label', 'Remove ' + device.label);
      button.onclick = async () => {
        button.disabled = true;
        try {
          const result = await request('revoke', { token: await authToken(), body: { id: device.id } });
          const data = await result.json();
          if (result.status === 403) {
            const link = document.createElement('a');
            link.href = 'index.html?connect=1';
            link.textContent = 'Sign in again';
            status.replaceChildren(link, ' with your authenticator to remove a device.');
          } else if (!result.ok) {
            throw new Error(data.error || 'Could not remove this device.');
          } else if (data.current && client.remembered) {
            setRememberedHint(false);
            location.replace('index.html?connect=1');
          } else {
            await render();
          }
        } catch (error) {
          status.textContent = error.message;
        } finally {
          button.disabled = false;
        }
      };
      row.append(details, button);
      return row;
    }));
  }
  try { await render(); }
  catch (error) { status.textContent = error.message; }
}
