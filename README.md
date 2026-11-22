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
3. Check the hosted migration ledger and apply only pending migrations under `supabase/migrations`. The seven historical files match the hosted ledger. The new schema changes must be applied before deploying the corresponding `mail-domain.ts` or publishing the new editor. GitHub Pages publishes from `main` with the exclusions in `_config.yml`. Existing Cloudflare routing and Resend credentials continue to serve Inbox.
4. Verify that unauthenticated users, a password-only session, and non-owner accounts cannot read or write domain mail or publish profile edits. Verify the owner can open Inbox and publish a profile edit after both factors. Gmail connection remains a separate authorization inside Inbox.

The release build excludes sample message data and disables local preview. **69** has no role in production authentication. The Edge Function checks the verified owner and password/TOTP claims before touching mail. A database policy restricts publishing to the same owner with both factors.

## Checks and browser security

Run `npm ci --prefix tests --ignore-scripts`, `npm test --prefix tests`, `node verify-mail.cjs` and `node verify-mail-worker.mjs`. The schema test replays every migration into an empty Postgres instance with the Supabase Auth objects stubbed.

HTML documents declare CSP and the sensitive pages require top-level navigation. Browsers require an HTTP header for `frame-ancestors`. GitHub Pages serves this domain directly today. `deployment/cloudflare-response-headers.json` is a response-header rule template for a proxied Cloudflare hostname. Before switching the public host to a proxy, confirm origin TLS settings, test the published host and Google account connection, and verify the response headers. Leave mail routing DNS records as configured.
