create or replace function private.assign_site_owner() returns trigger language plpgsql security invoker set search_path = '' as $$
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
drop trigger assign_site_owner on auth.users;
create trigger assign_site_owner before insert or update of email,email_confirmed_at,raw_app_meta_data on auth.users for each row execute function private.assign_site_owner();
