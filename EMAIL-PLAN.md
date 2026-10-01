# Email feasibility for MqMr OS

Assessed 2026-10-01. These are engineering estimates, not implemented email features. No OAuth scope, DNS, mailbox or provider account was changed.

| Scope | Estimated difficulty |
| --- | --- |
| Optional Gmail connection: inbox list and message reading | 6/10 |
| Gmail reading, replies, sending, attachments and search | 7/10 |
| Public multi-user Gmail client with verification and token isolation | 9/10 |
| Forward mqmr@mqmr.bio to the owner's existing Gmail | 3/10 |
| Owner-only domain inbox with aliases, replies and attachments | 8/10 |
| Independent domain mailboxes with user/account administration | 9/10 |

## Gmail connection

A Google sign-in is not permission to read email. Add a separate opt-in Connect Gmail flow requesting the minimum Gmail permissions, with a disconnect action. Reading/modify permissions are restricted scopes. A public app needs Google's verification; storing or transmitting restricted data through servers also requires a security assessment, subject to Google's exceptions. Personal-use apps with fewer than 100 users may qualify for an exception, but still have the unverified-app warning and policy obligations.

The Gmail API's standard use has no additional charge. Current documentation lists an 80,000,000 quota-unit daily threshold per project and plans future overage billing with notice; do not treat it as unlimited forever.

Sources: [Gmail scopes](https://developers.google.com/workspace/gmail/api/auth/scopes), [API limits/pricing](https://developers.google.com/workspace/gmail/api/reference/quota), [Verification exceptions](https://support.google.com/cloud/answer/13464323?hl=en).

## Owner-only domain mail

MqMr OS can let the verified mqmrpc@gmail.com account administer a private domain inbox. The backend must enforce the existing owner/admin identity on every request. Provider keys and refresh tokens stay server-side; mailbox records and attachments must never use the public site-content tables. Add private access rules, signed attachment access, webhook verification, duplicate-event handling, safe email HTML rendering and provider rate limits.

Aliases such as hello@mqmr.bio and support@mqmr.bio can share one inbox. Independent accounts are a larger feature requiring mailbox provisioning, permissions, separate quotas and provider administration. Site admin access does not itself grant Google Workspace domain-admin access.

Options:

- Free forwarding: Cloudflare Email Routing can route inbound domain mail to the existing Gmail address on its Free plan. This does not create an independent hosted mailbox. Arbitrary outbound Email Sending is currently a Workers Paid feature; sending to verified destination addresses is a separate free capability.
- Free limited custom inbox: Resend provides custom-domain inbound APIs/webhooks and outgoing mail. Its Free plan currently lists 3,000 emails/month, 100/day, three domains and 30-day provider retention. A private backend and our own inbox persistence are still required, with their own hosting/storage limits. This is a feasible small starting point, not an unlimited Gmail replacement.
- Managed mailboxes: Google Workspace Business Starter lists a regular US price of $7/user/month with a one-year commitment, before tax and outside introductory discounts. Google documents up to 30 aliases per user at no extra cost; aliases share the user's mailbox, while separate users need licenses. Regional pricing may differ.

Sources: [Cloudflare Email Service](https://developers.cloudflare.com/email-service/), [Resend inbound](https://resend.com/features/inbound), [Resend pricing](https://resend.com/pricing), [Workspace pricing](https://workspace.google.com/pricing.html), [Workspace aliases](https://support.google.com/a/answer/33327).

## Suggested next step

Start with an owner-only Inbox for mqmr@mqmr.bio and a small alias allow-list using a provider's free tier. Add optional Gmail connection for other users as a separate phase once the Inbox UX and private storage are proven. Domain registration/renewal remains a separate cost. Inspect existing DNS/mail hosting before choosing MX changes; preserve any working mail route.
