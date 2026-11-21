import { createServer } from 'node:http';
import { ownerEmail, ownerId, publishableKey, sdkIntegrity, sdkUrl, url } from '../mail-access.js';

const host = '127.0.0.1';
const port = 8765;
const origin = `http://${host}:${port}`;
const config = { ownerEmail, ownerId, publishableKey, url };
const page = `<!doctype html>
<html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width">
<title>Set the inbox password</title>
<style>
body{background:#171815;color:#f3f2ed;font:1rem/1.5 system-ui;max-width:32rem;margin:12vh auto;padding:0 1rem}
form{margin-top:1.5rem}input,button{font:inherit;padding:.65rem;margin:.4rem 0;border-radius:.45rem}
label,input{display:block}input{width:min(100%,25rem);box-sizing:border-box}
</style>
<main><h1>Set the inbox password</h1>
<p>Sign in with the existing Google owner account, then choose a password for this inbox.</p>
<button id="google" type="button" disabled>Continue with Google</button>
<form id="setup" method="post" hidden>
<label>New password<input id="password" type="password" autocomplete="new-password" minlength="12" maxlength="72" required></label>
<label>Confirm password<input id="confirm" type="password" autocomplete="new-password" minlength="12" maxlength="72" required></label>
<button type="submit">Save password</button>
</form>
<p id="status" role="status"></p></main>
<script src="${sdkUrl}" integrity="${sdkIntegrity}" crossorigin="anonymous"></script>
<script type="module">
const config = ${JSON.stringify(config)};
const status = document.querySelector('#status');
const google = document.querySelector('#google');
const form = document.querySelector('#setup');
const password = document.querySelector('#password');
const confirm = document.querySelector('#confirm');

try {
  const client = window.supabase.createClient(config.url, config.publishableKey, {
    auth: { flowType: 'pkce', storage: sessionStorage, storageKey: 'mqmr-owner-setup', autoRefreshToken: false }
  });
  const { data: { session } } = await client.auth.getSession();
  const isOwner = user => user?.id === config.ownerId && user.email === config.ownerEmail && user.app_metadata?.role === 'admin';

  if (session) {
    const { data, error } = await client.auth.getUser(session.access_token);
    if (!error && isOwner(data.user)) {
      google.hidden = true;
      form.hidden = false;
    } else {
      await client.auth.signOut({ scope: 'local' });
      status.textContent = 'Choose the existing inbox owner account.';
    }
  }

  google.disabled = false;
  google.onclick = async () => {
    const { error } = await client.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: location.origin + '/index.html', queryParams: { prompt: 'select_account' } }
    });
    if (error) status.textContent = 'Could not start Google sign-in.';
  };

  form.onsubmit = async event => {
    event.preventDefault();
    if (password.value !== confirm.value) {
      status.textContent = 'The passwords do not match.';
      return;
    }
    if (new TextEncoder().encode(password.value).length > 72) {
      status.textContent = 'Choose a password within 72 UTF-8 bytes.';
      return;
    }
    const save = form.querySelector('button');
    save.disabled = true;
    try {
      const { error } = await client.auth.updateUser({ password: password.value });
      if (error) {
        status.textContent = error.message || 'Could not save the password.';
        return;
      }
      form.hidden = true;
      status.textContent = 'Password saved. Close this page and use Access on the new homepage.';
      await client.auth.signOut({ scope: 'local' });
    } catch {
      status.textContent = 'Could not complete the request. Check your connection.';
    } finally {
      form.reset();
      save.disabled = false;
    }
  };
} catch {
  status.textContent = 'Could not load Supabase Auth. Check your connection and reload.';
}
</script></html>`;

createServer((request, response) => {
  const path = request.url?.split('?')[0];
  if (request.headers.host !== host + ':' + port || request.method !== 'GET' || (path !== '/' && path !== '/index.html')) {
    response.writeHead(404).end();
    return;
  }
  response.writeHead(200, {
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'no-store',
    'Referrer-Policy': 'no-referrer',
    'X-Frame-Options': 'DENY'
  }).end(page);
}).listen(port, host, () => console.log('Owner password setup: ' + origin));
