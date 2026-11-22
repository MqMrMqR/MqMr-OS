# MqR

A public profile with a private Inbox and profile editor.

## Preview the design

```sh
node build-static.mjs --preview
python -m http.server 8766 --bind 127.0.0.1 --directory .preview/site
```

Open `http://127.0.0.1:8766/`. Use **Access**, keep the sample email, enter any nonblank test password, then enter **69** to see sample messages. Preview mail actions stay in browser memory. **Connect** opens the profile editor after a sample server password and saves edits on this device.

## Set the real password and authenticator

1. Run `node tools/owner-password.mjs` and open `http://127.0.0.1:8765/`. Select **Continue with Google**, sign in as the existing site owner, choose a long unique password, and save it on that page. The helper is loopback-only and sends your password directly to Supabase Auth.
2. Stop the helper, run `node build-static.mjs` **without** the preview flag, then run `python -m http.server 8765 --bind 127.0.0.1 --directory dist`. Open **Access** and enter the owner's email and the new password. On first use, click **Set up authenticator**, scan the QR code, and enter the current six-digit code. Use the authenticator's current code on subsequent logins. Use port 8765 for live domain mail and Gmail locally.
3. Check the hosted migration ledger and apply only pending migrations under `supabase/migrations`. Apply the schema changes before publishing the corresponding editor and API code. GitHub Pages publishes from `main` with the exclusions in `_config.yml`. Existing Cloudflare routing and Resend credentials continue to serve Inbox.
4. Verify that unauthenticated users, a password-only session, and non-owner accounts cannot read or write domain mail or publish profile edits. Verify the owner can open Inbox and publish a profile edit after both factors. Gmail connection remains a separate authorization inside Inbox.

The release build excludes sample message data and disables local preview. **69** has no role in production authentication. The Edge Function checks the verified owner and password/TOTP claims before touching mail. A database policy restricts publishing to the same owner with both factors.

## Enable remembered devices

The optional device-session Worker serves `https://mqmr.bio/api/device-session/*` on the same origin as the site. Ordinary password and authenticator login remains available while this Worker is absent. The existing Cloudflare email Worker is independent.

1. Apply the migration ending in `profile_controls_and_device_sessions.sql` to the site's Supabase project. It enables larger profile photo payloads and adds a device-session table accessible only to the service role.
2. Confirm that HTTPS works for the GitHub Pages origin through Cloudflare. The `mqmr.bio` web record must be proxied for the Worker route to function. Leave the mail DNS records in place. Serve the private UI at the canonical `https://mqmr.bio` hostname.
3. Deploy `supabase/functions/device-sessions` as the `device-sessions` Edge Function with gateway JWT verification disabled. The handler authenticates requests itself using an HttpOnly session cookie or a verified Supabase owner token. It encrypts the stored credentials with a site-specific key derived from Supabase's server-only environment. If the Supabase service role key changes, clear remembered sessions so devices can sign in again.
4. Deploy the same-origin proxy with `npx wrangler deploy --config deployment/wrangler.device-session.toml` or upload `deployment/device-session-worker.mjs` in the Cloudflare dashboard and add the configured route. The Worker uses no Supabase secrets. Verify `GET /api/device-session/capability` on the canonical host and publish the static site. Test a new remembered login, opening Inbox in a new tab, removing the device after fresh MFA, and locking the editor. Check that a request without the cookie receives 401 for `/status`.

Remembered devices expire after 14 days. The Edge Function stores encrypted Supabase tokens server-side and sends the browser an opaque HttpOnly, Secure cookie through the same-origin proxy. The admin list shows the browser, operating system, last activity and expiry. Removing a device requires a recent authenticator check. Locking the site clears the remembered device. A new Gmail authorization remains separate from site sign-in.

## Checks and browser security

Run `npm ci --prefix tests --ignore-scripts`, `npm test --prefix tests`, `node verify-mail.cjs` and `node verify-mail-worker.mjs`. The schema test replays every migration into an empty Postgres instance with the Supabase Auth objects stubbed.

HTML documents declare CSP and the sensitive pages require top-level navigation. Browsers require an HTTP header for `frame-ancestors`. GitHub Pages serves this domain directly today. `deployment/cloudflare-response-headers.json` is a response-header rule template for a proxied Cloudflare hostname. Before switching the public host to a proxy, confirm origin TLS settings, test the published host and Google account connection, and verify the response headers. Leave mail routing DNS records as configured.
