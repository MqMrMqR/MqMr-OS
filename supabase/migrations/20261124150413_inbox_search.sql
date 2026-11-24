create schema if not exists extensions;
create extension if not exists pg_trgm with schema extensions;

create function private.mail_search_text(subject text, sender text, recipients text[], body text, html text)
returns text language sql immutable strict parallel safe set search_path = '' as $$
  select subject || ' ' || sender || ' ' || pg_catalog.array_to_string(recipients, ' ') || ' ' ||
    case when body <> '' then body else
      pg_catalog.regexp_replace(pg_catalog.regexp_replace(html, '<[^>]*>', ' ', 'g'), '[[:space:]]+', ' ', 'g')
    end
$$;

create function private.mail_search_pattern(term text)
returns text language sql immutable strict parallel safe set search_path = '' as $$
  select '%' || pg_catalog.replace(pg_catalog.replace(pg_catalog.replace(term, '\', '\\'), '%', '\%'), '_', '\_') || '%'
$$;

-- Resolve the operator class through either extension location without moving an existing extension.
do $index$
declare extension_schema text;
begin
  select n.nspname into strict extension_schema from pg_catalog.pg_extension e
    join pg_catalog.pg_namespace n on n.oid = e.extnamespace where e.extname = 'pg_trgm';
  execute pg_catalog.format(
    'create index mail_messages_search_text on public.mail_messages using gin (private.mail_search_text(subject, sender, recipients, text_body, html_body) %I.gin_trgm_ops)',
    extension_schema);
end
$index$;

create function public.mail_search(p_folder text, p_filters jsonb, p_cursor_date timestamptz default null, p_cursor_id uuid default null)
returns table (id uuid, sender text, recipients text[], subject text, body_preview text, unread boolean, starred boolean, created_at timestamptz)
language sql stable security invoker set search_path = '' as $$
  select m.id, m.sender, m.recipients, m.subject,
    case when m.body_preview <> '' then m.body_preview else left(private.mail_search_text('', '', '{}', '', m.html_body), 150) end,
    m.unread, m.starred, m.created_at
  from public.mail_messages as m
  where m.trash = (p_folder = 'TRASH')
    and (p_folder <> 'SENT' or m.direction = 'outbound')
    and (p_folder <> 'STARRED' or m.starred)
    and (p_folder <> 'INBOX' or (m.direction = 'inbound' and not m.archived))
    and (p_cursor_date is null or (m.created_at, m.id) < (p_cursor_date, p_cursor_id))
    and (p_filters->>'after' is null or m.created_at >= (p_filters->>'after')::timestamptz)
    and (p_filters->>'before' is null or m.created_at < (p_filters->>'before')::timestamptz)
    and (p_filters->>'unread' is null or m.unread = (p_filters->>'unread')::boolean)
    and (p_filters->>'starred' is distinct from 'true' or m.starred)
    and (p_filters->>'attachments' is distinct from 'true' or m.attachments <> '[]'::jsonb)
    and (p_filters->>'from' is null or m.sender ilike private.mail_search_pattern(p_filters->>'from'))
    and (p_filters->>'to' is null or exists (select 1 from unnest(m.recipients) r(address)
      where r.address ilike private.mail_search_pattern(p_filters->>'to')))
    and (p_filters->>'subject' is null or m.subject ilike private.mail_search_pattern(p_filters->>'subject'))
    and (p_filters->'terms'->>0 is null or private.mail_search_text(m.subject, m.sender, m.recipients, m.text_body, m.html_body)
      ilike private.mail_search_pattern(p_filters->'terms'->>0))
    and not exists (select 1 from jsonb_array_elements_text(coalesce(p_filters->'terms', '[]'::jsonb)) with ordinality t(term, position)
      where t.position > 1 and private.mail_search_text(m.subject, m.sender, m.recipients, m.text_body, m.html_body)
        not ilike private.mail_search_pattern(t.term))
  order by m.created_at desc, m.id desc
  limit 26
$$;

grant usage on schema private to service_role;
revoke all on function private.mail_search_text(text, text, text[], text, text), private.mail_search_pattern(text) from public, anon, authenticated;
grant execute on function private.mail_search_text(text, text, text[], text, text), private.mail_search_pattern(text) to service_role;
revoke all on function public.mail_search(text, jsonb, timestamptz, uuid) from public, anon, authenticated;
grant execute on function public.mail_search(text, jsonb, timestamptz, uuid) to service_role;
