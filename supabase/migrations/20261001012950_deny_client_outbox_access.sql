create policy server_only_outbox on public.mail_outbox for all to authenticated using(false) with check(false);
