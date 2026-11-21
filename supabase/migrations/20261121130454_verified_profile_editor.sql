create table public.profile_homepage (
  singleton boolean primary key default true check (singleton),
  payload jsonb not null check (jsonb_typeof(payload) = 'object' and octet_length(payload::text) <= 18000)
);

alter table public.profile_homepage enable row level security;
revoke all on public.profile_homepage from public, anon, authenticated;
grant select on public.profile_homepage to anon, authenticated;
grant insert, update on public.profile_homepage to authenticated;

create policy profile_is_public
  on public.profile_homepage for select to anon, authenticated using (true);

create policy verified_owner_edits_profile
  on public.profile_homepage for all to authenticated
  using (
    (select auth.uid()) = '5922fd59-f07a-4ec9-8939-abc615b7c640'::uuid
    and (select auth.jwt()) @> '{"email":"mqmrpc@gmail.com","app_metadata":{"role":"admin"},"aal":"aal2","amr":[{"method":"password"},{"method":"totp"}]}'::jsonb
  )
  with check (
    (select auth.uid()) = '5922fd59-f07a-4ec9-8939-abc615b7c640'::uuid
    and (select auth.jwt()) @> '{"email":"mqmrpc@gmail.com","app_metadata":{"role":"admin"},"aal":"aal2","amr":[{"method":"password"},{"method":"totp"}]}'::jsonb
  );
