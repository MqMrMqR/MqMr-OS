import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { pg_trgm } from '@electric-sql/pglite/contrib/pg_trgm';

const migrations = new URL('../supabase/migrations/', import.meta.url);

test('fresh schema replay, owner-only writes, conflict guard and lazy attachments', async () => {
  const db = new PGlite({ extensions: { pg_trgm } });
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
      values ($1,'fixture','inbound','sender@example.test',array['mqmr@mqmr.bio'],repeat('a',500) || ' internal billing_95 for الرياض',
      '[{"id":"1","name":"note.txt","data":"aGk="}]'::jsonb)`, [id]);
    await db.exec(`insert into public.mail_messages(provider_id,direction,sender,recipients,html_body,unread,subject)
      values ('html','inbound','billing@example.test',array['other@mqmr.bio'],'<div>Internal <b>billing</b> for جدة</div>',false,'Notice')`);
    await db.exec('set role authenticated');
    await setClaims({ ...owner, aal: 'aal1', amr: [{ method: 'password' }] });
    await assert.rejects(db.query("insert into public.profile_homepage(payload) values ('{}')"), { code: '42501' });
    await setClaims(owner);
    await db.exec("insert into public.profile_homepage(payload) values ('{}')");
    assert.equal((await db.query("update public.profile_homepage set payload='{\"name\":\"New\"}' where revision=1 returning revision")).rows[0].revision, 2);
    assert.equal((await db.query("update public.profile_homepage set payload='{}' where revision=1 returning revision")).rows.length, 0);
    await assert.rejects(db.query('select public.mail_read($1)', [id]), { code: '42501' });
    await assert.rejects(db.query("select * from public.mail_search('ALL','{}')"), { code: '42501' });
    await assert.rejects(db.query('select * from public.site_content'), { code: '42501' });
    await assert.rejects(db.query('select * from public.device_sessions'), { code: '42501' });
    await db.query("update public.profile_homepage set payload=jsonb_build_object('photo', repeat('a', 24000))");
    await assert.rejects(db.query("update public.profile_homepage set payload=jsonb_build_object('photo', repeat('a', 128000))"), { code: '23514' });
    await db.query("update public.profile_homepage set payload='{\"name\":\"New\"}'");
    await db.exec('set role anon');
    assert.deepEqual((await db.query('select payload from public.profile_homepage')).rows[0].payload, { name: 'New' });
    await assert.rejects(db.query('select * from public.device_sessions'), { code: '42501' });
    await db.exec('set role service_role');
    await db.query("insert into public.device_sessions(cookie_hash, credentials, label, expires_at) values (repeat('a',64),'sealed','Test browser',now()+interval '14 days')");
    assert.equal((await db.query('select label from public.device_sessions')).rows[0].label, 'Test browser');
    const detail = await db.query('select public.mail_read($1) as message', [id]);
    assert.deepEqual(detail.rows[0].message.attachments, [{ id: '1', name: 'note.txt' }]);
    const file = await db.query("select public.mail_attachment($1,'1') as data", [id]);
    assert.equal(file.rows[0].data, 'aGk=');
    assert.equal((await db.query('select length(body_preview) as length from public.mail_messages where id=$1', [id])).rows[0].length, 150);
    const search = async (filters, cursor = []) => (await db.query("select * from public.mail_search('ALL',$1,$2,$3)", [JSON.stringify(filters), cursor[0] ?? null, cursor[1] ?? null])).rows;
    const rows = await search({ terms: ['BILLING_95', 'الرياض'], from: 'sender@', to: 'mqmr@', attachments: true, unread: true });
    assert.deepEqual(rows.map(row => row.id), [id]);
    assert.equal((await search({ terms: ['billing%95'] })).length, 0);
    assert.equal((await search({ terms: ['billing', 'جدة'], unread: false }))[0].subject, 'Notice');
    assert.equal((await search({ terms: ['billing'], before: '2000-01-01T00:00:00Z' })).length, 0);
    const ordered = await search({ terms: ['billing'] });
    assert.equal(ordered.length, 2);
    assert.deepEqual((await search({ terms: ['billing'] }, [ordered[0].created_at, ordered[0].id])).map(row => row.id), [ordered[1].id]);
  } finally {
    await db.close();
  }
});
