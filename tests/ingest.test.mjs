import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import PostalMime from 'postal-mime';
import core from '../mail-core.js';

test('ingest accepts a signed Unicode message and preserves the inline image content ID', async () => {
  let receive;
  let stored;
  const secret = 'local-fixture-signing-key';
  const runtime = {
    env: { get: key => key === 'MAIL_INGEST_SECRET' ? secret : '' },
    serve: handler => { receive = handler; }
  };
  const createClient = () => ({ from: () => ({ upsert: async row => { stored = row; return { error: null }; } }) });
  const input = readFileSync(new URL('../mail-ingest.ts', import.meta.url), 'utf8');
  const source = input.replace(/^import .*;\r?\n/gm, '');
  new Function('Deno', 'createClient', 'PostalMime', stripTypeScriptTypes(source))(runtime, createClient, PostalMime);
  const raw = [
    'From: test@example.test', 'To: mqmr@mqmr.bio', `Subject: =?UTF-8?B?${core.encode('تجربة البريد')}?=`,
    'MIME-Version: 1.0', 'Content-Type: multipart/related; boundary="fixture"', '',
    '--fixture', 'Content-Type: multipart/alternative; boundary="bodies"', '',
    '--bodies', 'Content-Type: text/plain; charset=UTF-8', 'Content-Transfer-Encoding: base64', '', core.encode('نص عربي 👋'),
    '--bodies', 'Content-Type: text/html; charset=UTF-8', 'Content-Transfer-Encoding: base64', '',
    core.encode('<p>نص عربي 👋</p><img src="cid:photo@example.test">'), '--bodies--',
    '--fixture', 'Content-Type: image/png', 'Content-Disposition: inline; filename="photo.png"',
    'Content-ID: <photo@example.test>', 'Content-Transfer-Encoding: base64', '', 'aGk=', '--fixture--'
  ].join('\r\n');
  const timestamp = String(Date.now());
  const body = JSON.stringify({ id: 'fixture', from: 'test@example.test', to: 'mqmr@mqmr.bio', raw: Buffer.from(raw).toString('base64') });
  const utf8 = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', utf8.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = Buffer.from(await crypto.subtle.sign('HMAC', key, utf8.encode(timestamp + '.' + body))).toString('hex');
  const response = await receive(new Request('https://example.test', {
    method: 'POST', headers: { 'x-mail-timestamp': timestamp, 'x-mail-signature': signature }, body
  }));
  assert.equal(response.status, 200);
  assert.equal(stored.subject, 'تجربة البريد');
  assert.equal(stored.text_body.trim(), 'نص عربي 👋');
  assert.equal(stored.attachments[0].data, 'aGk=');
  assert.equal(stored.attachments[0].contentId, '<photo@example.test>');
});

test('Gmail reads referenced text while leaving named attachments for download', async () => {
 const requested = [];
 const result = await core.resolveParts({ parts: [
   { mimeType: 'text/plain', body: { attachmentId: 'body' } },
   { mimeType: 'text/html', body: { attachmentId: 'html' } },
   { mimeType: 'text/plain', filename: 'named.txt', body: { attachmentId: 'file' } },
   { mimeType: 'image/png', headers: [{ name: 'Content-ID', value: '<photo@example.test>' }], body: { attachmentId: 'inline' } }
 ] }, async id => { requested.push(id); return { data: core.url64('مرحبا') }; });
 assert.deepEqual(requested, ['body']);
 assert.equal(result.text, 'مرحبا');
 assert.equal(result.files[0].id, 'file');
 assert.equal(result.files[1].id, 'inline');
 assert.equal(result.files[1].contentId, '<photo@example.test>');
});
