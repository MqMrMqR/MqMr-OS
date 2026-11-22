import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

const migrations = new URL('../supabase/migrations/', import.meta.url);

test('fresh schema replay, owner-only writes, conflict guard and lazy attachments', async () => {
  const db = new PGlite();
  try {
    // Hosted Supabase creates these roles and Auth objects before project migrations run.
    await db.exec(`
      create role anon;
      create role authenticated;
      create role service_role bypassrls;
      create schema auth;
      create table auth.users (email text, email_confirmed_at timestamptz, raw_app_meta_data jsonb);
      create function auth.jwt() returns jsonb language sql stable as
       $$ select coalesce(nullif(current_setting('request.jwt.claims',true), ''), '{}')::jsonb $$;
      create function auth.uid() returns uuid language sql stable as
       $$ select (auth.jwt()->>'sub')::uuid $$;
      grant usage on schema auth to anon,authenticated;
    `);
    for (const name of readdirSync(migrations).filter(name => name.endsWith('.sql')).sort()) {
      await db.exec(readFileSync(new URL(name, migrations), 'utf8'));
    }

    const owner = { sub: '5922fd59-f07a-4ec9-8939-abc615b7c640', email: 'mqmrpc@gmail.com',
      app_metadata: { role: 'admin' }, aal: 'aal2', amr: [{ method: 'password' }, { method: 'totp' }] };
    const setClaims = claims => db.query("select set_config('request.jwt.claims', $1, false)", [JSON.stringify(claims)]);
    const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    await db.query(`insert into public.mail_messages(id,provider_id,direction,sender,recipients,text_body,attachments)
      values ($1,'fixture','inbound','sender@example.test',array['mqmr@mqmr.bio'],repeat('a',500),
      '[{"id":"1","name":"note.txt","data":"aGk="}]'::jsonb)`, [id]);
    await db.exec('set role authenticated');
    await setClaims({ ...owner, aal: 'aal1', amr: [{ method: 'password' }] });
    await assert.rejects(db.query("insert into public.profile_homepage(payload) values ('{}')"), { code: '42501' });
    await setClaims(owner);
    await db.exec("insert into public.profile_homepage(payload) values ('{}')");
    assert.equal((await db.query("update public.profile_homepage set payload='{\"name\":\"New\"}' where revision=1 returning revision")).rows[0].revision, 2);
    assert.equal((await db.query("update public.profile_homepage set payload='{}' where revision=1 returning revision")).rows.length, 0);
    await assert.rejects(db.query('select public.mail_read($1)', [id]), { code: '42501' });
    await assert.rejects(db.query('select * from public.site_content'), { code: '42501' });
    await db.exec('set role anon');
    assert.deepEqual((await db.query('select payload from public.profile_homepage')).rows[0].payload, { name: 'New' });
    await db.exec('set role service_role');
    const detail = await db.query('select public.mail_read($1) as message', [id]);
    assert.deepEqual(detail.rows[0].message.attachments, [{ id: '1', name: 'note.txt' }]);
    const file = await db.query("select public.mail_attachment($1,'1') as data", [id]);
    assert.equal(file.rows[0].data, 'aGk=');
    assert.equal((await db.query('select length(body_preview) as length from public.mail_messages')).rows[0].length, 150);
  } finally {
    await db.close();
  }
});
