-- Reject writes based on a stale profile snapshot.
alter table public.profile_homepage add column revision bigint not null default 1;

create function private.bump_profile_revision() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  new.revision = old.revision + 1;
  return new;
end;
$$;

create trigger bump_profile_revision before update on public.profile_homepage
for each row execute function private.bump_profile_revision();

-- Keep historical data available to database operators only.
revoke all on public.site_content from public, anon, authenticated;

alter table public.mail_messages add column body_preview text
  generated always as (left(text_body, 150)) stored;

create function public.mail_read(p_message_id uuid) returns jsonb
language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object(
    'id', message.id, 'reply_to', message.reply_to, 'recipients', message.recipients,
    'text_body', message.text_body, 'html_body', message.html_body,
    'attachments', coalesce(
      (select jsonb_agg(item - 'data' order by ord)
        from jsonb_array_elements(message.attachments) with ordinality as a(item, ord)),
      '[]'::jsonb))
  from public.mail_messages as message
  where message.id = p_message_id;
$$;

create function public.mail_attachment(p_message_id uuid, p_attachment_id text) returns text
language sql stable security invoker set search_path = '' as $$
  select item ->> 'data'
  from public.mail_messages as message, lateral jsonb_array_elements(message.attachments) as a(item)
  where message.id = p_message_id and item ->> 'id' = p_attachment_id
  limit 1;
$$;

revoke all on function public.mail_read(uuid), public.mail_attachment(uuid, text) from public, anon, authenticated;
grant execute on function public.mail_read(uuid), public.mail_attachment(uuid, text) to service_role;
