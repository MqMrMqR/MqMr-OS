# Inbox setup

Inbox is a desktop app (`inbox.html` can also open directly). It has a three-column Apple-style interface and follows Light, Dark and Automatic appearance.

## Google accounts

The ordinary Supabase Google sign-in keeps its existing identity scopes. Inbox separately requests `gmail.modify` through Google Identity Services on the explicit Add Google account action. Each Google account must consent; accounts can be switched independently. Access tokens live in browser memory, go directly to Gmail API, and disappear on reload/closing the page. They are never persisted or sent to Supabase.

Gmail API was enabled in Google Cloud project `mqmrs-os`. Public OAuth client ID is in `inbox-config.js`. `https://mqmr.bio` and local origin `http://127.0.0.1:8765` are authorized; the local origin was saved and verified on 2026-10-01. Never put the OAuth client secret into static files.

The OAuth project remains External / Testing. With owner approval, `gmail.modify` was saved and `mqmrpc@gmail.com` was added as a test user. This does not publish the app.

Production availability of `gmail.modify` depends on Google's restricted-scope verification and the project's audience/test-user configuration. Keep testing restricted to approved test users until Google accepts the app. The client-only design avoids transmitting Gmail data through this site's backend; Google still determines verification requirements.

Supported: account switching, Inbox/All Mail/Starred/Sent/Drafts/Junk/Trash lists, Gmail search, read/unread, stars, archive, recoverable Trash/restore, plaintext message reading, replies, sending and attachment downloads. Existing drafts are readable, but draft editing/saving, labels management and background notifications are future work. HTML-only mail is rendered as safe text with no scripts or remote tracking images. Attachment total is limited to 10 MB.

## Owner domain mail

Only the authenticated user `mqmrpc@gmail.com` with trusted `app_metadata.role=admin` can manage domain mail. Both the Edge Function and RLS enforce this. Other site users cannot read messages, create aliases or send domain email. `mail_outbox` has no browser access.

`mail-schema.sql` was applied to Supabase project `ebufvcuxcypoxwbvcbjg`. `mail-domain.ts` and `mail-ingest.ts` are deployed Edge Functions. Gateway JWT checking is disabled because each function performs explicit custom authentication: validated Supabase session for owner operations; HMAC-SHA256 signed timestamped request for mail ingestion.

### Sending

In Resend, create **MqMr OS Inbox**, **Sending access**, restricted to **mqmr.bio**. The user must create/copy the credential and save it as Supabase secret `RESEND_API_KEY`. Do not put it in this repository or a browser script. Resend domain verification must remain valid. Sender aliases created in Inbox control allowed From addresses; `mqmr@mqmr.bio` is the initial alias. Domain sends are limited to 30 requests/hour and use provider idempotency; expired retry requests require checking Sent before sending a fresh message.

CineLedger's custom SMTP was disabled with explicit owner approval. Its authentication emails now use Supabase defaults, including the built-in sending limit and reset templates. The old Resend key was not deleted because it may be needed for recovery or another integration.

### Receiving

Cloudflare account: `ae7c8fcac9d2a0ea65755c02b804d545`. Domain `mqmr.bio` was added on Free plan, with nine imported DNS records. GitHub Pages A/CNAME records are DNS only. Resend `send` MX/SPF and `resend._domainkey` DKIM and `_dmarc` TXT are preserved.

Cloudflare-assigned nameservers:
- `alan.ns.cloudflare.com`
- `rihana.ns.cloudflare.com`

On 2026-10-01, all Namecheap records were compared with Cloudflare. Namecheap had both a stale parking-page www CNAME and the GitHub Pages www CNAME; Cloudflare retains only the correct `mqmrmqr.github.io` target. All four apex A records and Resend MX/SPF/DKIM/DMARC match. Namecheap DNSSEC was already off. Custom DNS was saved with the two Cloudflare nameservers above. Public delegation now resolves to these servers and Cloudflare reports the domain active. A DNS-record snapshot is saved locally in `dns-records-before-activation.txt`.

Worker: **mqmr-mail-inbound**, source `cloudflare-mail-worker.js`. It has only an email handler; no public mail-ingestion HTTP endpoint or scheduled test job. The source is deployed. The user saved `MAIL_INGEST_SECRET` in the Worker and Supabase; Supabase's digest differs from `RESEND_API_KEY`. Values were not read. Successful signed inbound delivery on 2026-10-01 confirms the two services use matching ingestion secrets.

With explicit owner approval, Cloudflare Email Routing is enabled and **Catch-all -> Send to Worker -> mqmr-mail-inbound** is active. Its wizard added apex Cloudflare MX/SPF and DKIM records while preserving Resend's `send` subdomain records. Public MX resolution confirms all three Cloudflare routes. This routes all local parts to the Worker; extra Cloudflare rules are not needed for sender aliases. Actual Worker-to-storage delivery succeeded in the self-test below.

The Worker accepts mqmr.bio recipients only, limits messages to 10 MB, hashes the raw message plus recipient for duplicate identity, and signs the envelope with HMAC and a timestamp. Supabase checks signatures and a five-minute window, parses MIME using pinned `postal-mime@3.0.0`, and stores body/attachments privately. Delivery/storage errors are surfaced rather than reported as success. Attachments occupy database space; add object storage and retention controls before high-volume use.

## Validation

Run `node verify-mail.cjs`, `node verify-mail-worker.mjs`, existing desktop/theme/editor verification scripts and `node build-static.mjs`.

The browser verified owner-only mailbox loading and initial alias, Inbox dark styling, dark Projects computed colors, and successful connection/loading of Gmail for the approved test account on 2026-10-01. Gmail send/modify operations and multiple-account switching have not been tested against live accounts.

After the user replaced Supabase `RESEND_API_KEY`, the approved self-test from `mqmr@mqmr.bio` to itself succeeded on 2026-10-01. Supabase recorded the outbound message at 13:14:37 UTC and the signed inbound message at 13:14:39 UTC. The local Inbox displayed and opened the received subject/body. This verifies Resend sending, Cloudflare routing/Worker delivery, matching ingestion secrets, MIME storage and owner mailbox reading for one plaintext message. Attachments and delivery to arbitrary external recipients were not part of this live test. The backend exposes only provider HTTP status and allowlisted error codes on failure, never raw provider bodies or credentials.

## References

- Google browser token flow: https://developers.google.com/identity/oauth2/web/guides/use-token-model
- Gmail scopes: https://developers.google.com/gmail/api/auth/scopes
- Cloudflare Email Workers: https://developers.cloudflare.com/email-routing/email-workers/
- Resend idempotency: https://resend.com/docs/dashboard/emails/idempotency-keys
- PostalMime: https://www.npmjs.com/package/postal-mime/v/3.0.0
