create table public.site_content (
 path text primary key check (path in ('main-data.json','settings-data.json','Apps/AboutMe.json','Apps/Projects.json','Apps/Workspace.json','Apps/Contact.json','Apps/Settings.json','Apps/Terminal.json')),
 content jsonb not null check (jsonb_typeof(content) = 'object'),
 updated_at timestamptz not null default now()
);
alter table public.site_content enable row level security;
grant select on public.site_content to anon, authenticated;
grant insert, update on public.site_content to authenticated;
create policy "Public content is readable" on public.site_content for select to anon, authenticated using (true);
create policy "Admin can insert content" on public.site_content for insert to authenticated with check ((select auth.jwt()->'app_metadata'->>'role') = 'admin');
create policy "Admin can update content" on public.site_content for update to authenticated using ((select auth.jwt()->'app_metadata'->>'role') = 'admin') with check ((select auth.jwt()->'app_metadata'->>'role') = 'admin');

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
create function private.assign_site_owner() returns trigger language plpgsql security invoker set search_path = '' as $$
begin
 if lower(new.email) = 'mqmrpc@gmail.com' and new.email_confirmed_at is not null
 and new.raw_app_meta_data->>'provider' = 'google' then
   new.raw_app_meta_data = coalesce(new.raw_app_meta_data, '{}'::jsonb) || '{"role":"admin"}'::jsonb;
 elsif new.raw_app_meta_data->>'role' = 'admin' then
   new.raw_app_meta_data = new.raw_app_meta_data - 'role';
 end if;
 return new;
end;
$$;
revoke all on function private.assign_site_owner() from public, anon, authenticated;
create trigger assign_site_owner before insert or update of email, email_confirmed_at, raw_app_meta_data on auth.users for each row execute function private.assign_site_owner();
