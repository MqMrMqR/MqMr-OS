import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import PostalMime from 'postal-mime';
import core from '../mail-core.js';
import { quoteParts, safeMailUrl, validOutgoingHtml } from '../mail-format.js';

test('plain replies keep separate quotes and a nested quote with wrapped attribution', () => {
  const parsed = quoteParts('Reply\n\nOn Saturday, Alex\nwrote:\n> Previous\n> On Friday, Pat wrote:\n> > Original\n\nCurrent note\n\nOn Thursday, Lee wrote:\n> Second quote');
  assert.equal(parsed[0].trim(), 'Reply');
  assert.equal(parsed[1].title, 'On Saturday, Alex wrote:');
  assert.equal(parsed[1].parts[0], 'Previous');
  assert.deepEqual(parsed[1].parts[1], { title: 'On Friday, Pat wrote:', parts: ['Original'] });
  assert.equal(parsed[2].trim(), 'Current note');
  assert.deepEqual(parsed[3], { title: 'On Thursday, Lee wrote:', parts: ['Second quote'] });
});

test('email hyperlinks and composed markup use the supported format', () => {
  assert.equal(safeMailUrl('https://example.test/path?a=1&b=2'), 'https://example.test/path?a=1&b=2');
  assert.equal(safeMailUrl('mailto:writer@example.test'), 'mailto:writer@example.test');
  assert.equal(safeMailUrl('ftp://example.test/'), null);
  assert.equal(safeMailUrl('https://login@example.test/'), null);
  assert.equal(validOutgoingHtml('<div>Hello <b>Ethan</b><br><a href="https://example.test/?a=1&amp;b=2">Visit</a></div>'), true);
  assert.equal(validOutgoingHtml('<span style="color:red">Text</span>'), false);
  assert.equal(validOutgoingHtml('<p><b>Unbalanced</p>'), false);
});

test('Gmail rich mail preserves the plain alternative, Unicode, and attachments', async () => {
  const html = '<div><b>مرحبًا</b> <a href="https://example.test/">Example</a></div>';
  const message = await PostalMime.parse(core.decode(core.mime({
    from: 'sender@example.test', to: 'reader@example.test', subject: 'Formatted message',
    text: 'مرحبًا Example', html, files: [{ name: 'note.txt', type: 'text/plain', content: 'aGk=' }]
  })));
  assert.equal(message.text.trim(), 'مرحبًا Example');
  assert.equal(message.html.trim(), html);
  assert.equal(message.attachments[0].filename, 'note.txt');
});

test('domain sender forwards and stores supported formatting while keeping plain-only mail compatible', async () => {
  const owner = '5922fd59-f07a-4ec9-8939-abc615b7c640';
  const email = 'mqmrpc@gmail.com';
  const token = 'fixture.' + Buffer.from(JSON.stringify({
    sub: owner, aal: 'aal2', amr: [{ method: 'password' }, { method: 'totp' }]
  })).toString('base64url') + '.fixture';
  let receive, claim, stored, provider;
  const db = {
    auth: { getUser: async () => ({ data: { user: { id: owner, email, app_metadata: { role: 'admin' } } } }) },
    from: table => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => (table === 'mail_addresses' ? { data: { address: 'fixture@example.test' } } : { data: null }),
          single: async () => ({ data: { ...claim, created_at: new Date().toISOString(), state: 'pending' } })
        }),
        gte: async () => ({ count: 0 })
      }),
      insert: async row => { claim = row; return {}; },
      upsert: async row => { stored = row; return {}; },
      update: () => ({ eq: async () => ({}) })
    })
  };
  const runtime = { env: { get: () => 'fixture' }, serve: handler => { receive = handler; } };
  const request = async (_url, options) => {
    provider = JSON.parse(options.body);
    return Response.json({ id: 'fixture-id' });
  };
  const source = readFileSync(new URL('../mail-domain.ts', import.meta.url), 'utf8').replace(/^import .*;\r?\n/gm, '');
  new Function('Deno', 'createClient', 'validOutgoingHtml', 'fetch', stripTypeScriptTypes(source))(runtime, () => db, validOutgoingHtml, request);
  const send = values => receive(new Request('https://example.test', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token },
    body: JSON.stringify({
      action: 'send', idempotencyKey: crypto.randomUUID(), from: 'fixture@example.test',
      to: 'reader@example.test', subject: 'Formatting', text: 'Hello Ethan', ...values
    })
  }));
  const html = '<p>Hello <b>Ethan</b></p>';
  assert.equal((await send({ html })).status, 200);
  assert.equal(provider.html, html);
  assert.equal(stored.html_body, html);
  assert.equal(stored.text_body, 'Hello Ethan');
  assert.equal((await send({})).status, 200);
  assert.equal(Object.hasOwn(provider, 'html'), false);
  assert.equal(stored.html_body, '');
});
