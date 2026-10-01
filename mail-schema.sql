-- Domain mail is private. Gmail messages/tokens are never stored here.
create table if not exists public.mail_addresses (
 address text primary key check (address ~ '^[a-z0-9][a-z0-9._+-]{0,63}@mqmr\.bio$'),
 created_at timestamptz not null default now()
);
create table if not exists public.mail_messages (
 id uuid primary key default gen_random_uuid(), provider_id text not null unique,
 direction text not null check(direction in ('inbound','outbound')),
 sender text not null, recipients text[] not null, reply_to text,
 subject text not null default '', text_body text not null default '', html_body text not null default '',
 attachments jsonb not null default '[]'::jsonb,
 unread boolean not null default true, starred boolean not null default false,
 archived boolean not null default false, trash boolean not null default false,
 created_at timestamptz not null default now()
);
create index if not exists mail_messages_created on public.mail_messages(created_at desc,id desc);
create table if not exists public.mail_outbox (
 id uuid primary key, sender text not null, recipient text not null, request_hash text not null,
 state text not null default 'pending' check(state in ('pending','sent','failed')),
 provider_id text, created_at timestamptz not null default now()
);
alter table public.mail_addresses enable row level security;
alter table public.mail_messages enable row level security;
alter table public.mail_outbox enable row level security;
-- Client reads require the verified owner role; mutations use the validated API.
create policy owner_reads_mail on public.mail_messages for select to authenticated
 using ((select auth.jwt()->>'email')='mqmrpc@gmail.com' and (select auth.jwt()->'app_metadata'->>'role')='admin');
create policy owner_reads_addresses on public.mail_addresses for select to authenticated
 using ((select auth.jwt()->>'email')='mqmrpc@gmail.com' and (select auth.jwt()->'app_metadata'->>'role')='admin');
revoke all on public.mail_addresses,public.mail_messages,public.mail_outbox from anon,authenticated;
grant select on public.mail_addresses,public.mail_messages to authenticated;
grant all on public.mail_addresses,public.mail_messages,public.mail_outbox to service_role;
insert into public.mail_addresses(address) values('mqmr@mqmr.bio') on conflict do nothing;
create policy server_only_outbox on public.mail_outbox for all to authenticated using(false) with check(false);
