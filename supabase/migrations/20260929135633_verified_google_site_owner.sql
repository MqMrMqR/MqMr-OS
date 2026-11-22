create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
create function private.assign_site_owner() returns trigger language plpgsql security invoker set search_path = '' as $$
begin
 if lower(new.email) = 'mqmrpc@gmail.com' and new.email_confirmed_at is not null
 and new.raw_app_meta_data->>'provider' = 'google' then
   new.raw_app_meta_data = coalesce(new.raw_app_meta_data, '{}'::jsonb) || '{"role":"admin"}'::jsonb;
 end if;
 return new;
end;
$$;
revoke all on function private.assign_site_owner() from public, anon, authenticated;
create trigger assign_site_owner before insert or update of email_confirmed_at, raw_app_meta_data on auth.users for each row execute function private.assign_site_owner();
