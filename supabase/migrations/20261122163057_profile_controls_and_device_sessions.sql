alter table public.profile_homepage drop constraint profile_homepage_payload_check;
alter table public.profile_homepage add constraint profile_homepage_payload_check
  check (jsonb_typeof(payload) = 'object' and octet_length(payload::text) <= 128000);

create table public.device_sessions (
  id uuid primary key default gen_random_uuid(),
  cookie_hash text not null unique check (cookie_hash ~ '^[0-9a-f]{64}$'),
  credentials text not null,
  credential_version uuid not null default gen_random_uuid(),
  refresh_until timestamptz,
  label text not null check (char_length(label) between 1 and 64),
  last_seen_at timestamptz not null default now(),
  expires_at timestamptz not null
);

alter table public.device_sessions enable row level security;
revoke all on public.device_sessions from public, anon, authenticated;
grant select, insert, update, delete on public.device_sessions to service_role;

create index device_sessions_expiry on public.device_sessions (expires_at);
