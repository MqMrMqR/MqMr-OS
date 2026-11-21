-- All direct reads and writes go through the mailbox edge functions.
-- RLS remains enabled. Existing rows and service-role permissions are preserved.
revoke all on public.mail_addresses, public.mail_messages, public.mail_outbox
  from public, anon, authenticated;

drop policy if exists owner_reads_mail on public.mail_messages;
drop policy if exists owner_reads_addresses on public.mail_addresses;
