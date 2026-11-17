-- Welcome bonus: credited once when a client first appears (from the widget, CRM or manually)
create or replace function public.moloko_clients_welcome() returns trigger
language plpgsql security definer set search_path = public as $$
declare v int;
begin
  select coalesce((data->'loyalty'->>'welcome')::int, 0) into v from public.moloko_settings
   where id = 1 and coalesce((data->'loyalty'->>'enabled')::boolean, true);
  if coalesce(v, 0) > 0 and not exists (select 1 from public.moloko_bonus_tx where phone = new.phone and kind = 'welcome') then
    insert into public.moloko_bonus_tx (phone, amount, kind, note) values (new.phone, v, 'welcome', 'Приветственные бонусы');
  end if;
  return null;
end $$;
revoke execute on function public.moloko_clients_welcome() from public, anon, authenticated;
drop trigger if exists moloko_clients_welcome on public.moloko_clients;
create trigger moloko_clients_welcome after insert on public.moloko_clients
  for each row execute function public.moloko_clients_welcome();
