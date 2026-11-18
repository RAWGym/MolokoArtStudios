-- =====================================================================
-- Moloko v2 · всё для базы одним файлом
-- Как применить: Supabase → SQL Editor → New query → вставить ВЕСЬ файл → Run.
-- Можно запускать повторно: скрипт ничего не ломает и не удаляет данные.
-- Всё выполняется одной транзакцией: при ошибке ничего не изменится.
-- Внутри: приветственные бонусы, роли (бухгалтер, тех, SMM), запросы владельцу,
-- комбо-бронь, доходы и расходы, сертификаты и абонементы, рефералы,
-- кабинет клиента, приглашения, хранилище фото и видео залов.
-- =====================================================================
begin;

-- ===================== 20261118030000_moloko_welcome_bonus.sql
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

-- ===================== 20261118040000_moloko_v2.sql
-- Moloko v2: roles, approvals, money ledger, certificates, combined bookings,
-- client accounts with referral codes, editable widget catalogue.

-- ------------------------------------------------------------------ roles
alter table public.moloko_staff drop constraint if exists moloko_staff_role_check;
alter table public.moloko_staff add constraint moloko_staff_role_check
  check (role in ('owner','admin','accountant','tech','smm'));

create or replace function public.moloko_role() returns text
language sql stable security definer set search_path = public as $$
  select role from public.moloko_staff where user_id = auth.uid() and not disabled;
$$;
create or replace function public.moloko_has(p_roles text[]) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.moloko_role() = any(p_roles), false);
$$;

-- ------------------------------------------------------------------ halls are editable now
alter table public.moloko_bookings drop constraint if exists moloko_bookings_hall_check;
alter table public.moloko_bookings add constraint moloko_bookings_hall_check check (hall ~ '^[a-z0-9_-]{2,24}$');
alter table public.moloko_bookings add column if not exists group_id uuid;
create index if not exists moloko_bookings_group_idx on public.moloko_bookings (group_id);

-- ------------------------------------------------------------------ booking permissions by role
-- owner: everything. admin: create; edit and cancel only recent/upcoming bookings (from 2 days ago);
-- older ones and deletions go through a request to the owner. tech: closes halls (blocks) only.
-- accountant and smm: read-only.
drop policy if exists moloko_bookings_staff on public.moloko_bookings;
drop policy if exists moloko_bookings_read on public.moloko_bookings;
drop policy if exists moloko_bookings_insert on public.moloko_bookings;
drop policy if exists moloko_bookings_update on public.moloko_bookings;
drop policy if exists moloko_bookings_delete on public.moloko_bookings;
create policy moloko_bookings_read on public.moloko_bookings for select to authenticated using (public.moloko_is_staff());
create policy moloko_bookings_insert on public.moloko_bookings for insert to authenticated with check (
  public.moloko_has(array['owner','admin']) or (public.moloko_has(array['tech']) and status = 'block'));
create policy moloko_bookings_update on public.moloko_bookings for update to authenticated
  using (public.moloko_has(array['owner'])
      or (public.moloko_has(array['admin']) and status <> 'block' and date >= (now() at time zone 'Asia/Almaty')::date - 2)
      or (public.moloko_has(array['admin','tech']) and status = 'block'))
  with check (public.moloko_has(array['owner'])
      or (public.moloko_has(array['admin']) and status <> 'block' and date >= (now() at time zone 'Asia/Almaty')::date - 2)
      or (public.moloko_has(array['admin','tech']) and status = 'block'));
create policy moloko_bookings_delete on public.moloko_bookings for delete to authenticated
  using (public.moloko_has(array['owner']) or (public.moloko_has(array['admin','tech']) and status = 'block'));

-- clients: owner/admin write, everyone on staff reads
drop policy if exists moloko_clients_staff on public.moloko_clients;
drop policy if exists moloko_clients_read on public.moloko_clients;
drop policy if exists moloko_clients_write on public.moloko_clients;
drop policy if exists moloko_clients_update on public.moloko_clients;
create policy moloko_clients_read on public.moloko_clients for select to authenticated using (public.moloko_is_staff());
create policy moloko_clients_write on public.moloko_clients for insert to authenticated with check (public.moloko_has(array['owner','admin']));
create policy moloko_clients_update on public.moloko_clients for update to authenticated
  using (public.moloko_has(array['owner','admin'])) with check (public.moloko_has(array['owner','admin']));

drop policy if exists moloko_bonus_manual on public.moloko_bonus_tx;
create policy moloko_bonus_manual on public.moloko_bonus_tx for insert to authenticated
  with check (public.moloko_has(array['owner','admin']) and kind = 'manual' and created_by = auth.uid());

-- audit: owner and accountant
drop policy if exists moloko_audit_read on public.moloko_audit;
create policy moloko_audit_read on public.moloko_audit for select to authenticated using (public.moloko_has(array['owner','accountant']));

-- settings: owner writes everything, smm edits the widget showcase only (enforced by trigger below)
drop policy if exists moloko_settings_write on public.moloko_settings;
create policy moloko_settings_write on public.moloko_settings for all to authenticated
  using (public.moloko_has(array['owner','smm'])) with check (public.moloko_has(array['owner','smm']));

create or replace function public.moloko_settings_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare k text;
begin
  if public.moloko_role() = 'smm' then
    -- SMM may change halls' look, announcement, hours window and options text; not money or messages
    foreach k in array array['halls','night','guest','freeGuests','confetti','equip','loyalty','templates','referral','reviewUrl'] loop
      if old.data ? k then new.data := jsonb_set(new.data, array[k], old.data->k); else new.data := new.data - k; end if;
    end loop;
    if old.data ? 'catalog' and new.data ? 'catalog' then
      -- keep owner-set prices inside the catalogue untouched
      new.data := jsonb_set(new.data, '{catalog,equip}', coalesce(old.data->'catalog'->'equip', new.data->'catalog'->'equip'));
    end if;
  end if;
  return new;
end $$;
drop trigger if exists moloko_settings_guard on public.moloko_settings;
create trigger moloko_settings_guard before update on public.moloko_settings
  for each row execute function public.moloko_settings_guard();

-- ------------------------------------------------------------------ approval requests (admin -> owner)
create table if not exists public.moloko_requests (
  id          uuid primary key default gen_random_uuid(),
  booking_id  uuid references public.moloko_bookings(id) on delete cascade,
  kind        text not null check (kind in ('delete','edit','cancel','refund','other')),
  payload     jsonb not null default '{}'::jsonb,
  note        text not null default '',
  status      text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_at  timestamptz not null default now(),
  created_by  uuid not null default auth.uid(),
  decided_at  timestamptz,
  decided_by  uuid,
  answer      text not null default ''
);
create index if not exists moloko_requests_status_idx on public.moloko_requests (status, created_at desc);
alter table public.moloko_requests enable row level security;
drop policy if exists moloko_requests_read on public.moloko_requests;
drop policy if exists moloko_requests_insert on public.moloko_requests;
drop policy if exists moloko_requests_decide on public.moloko_requests;
create policy moloko_requests_read on public.moloko_requests for select to authenticated
  using (public.moloko_has(array['owner']) or created_by = auth.uid());
create policy moloko_requests_insert on public.moloko_requests for insert to authenticated
  with check (public.moloko_is_staff() and created_by = auth.uid() and status = 'pending');
create policy moloko_requests_decide on public.moloko_requests for update to authenticated
  using (public.moloko_has(array['owner'])) with check (public.moloko_has(array['owner']));
grant select, insert, update on public.moloko_requests to authenticated;

-- ------------------------------------------------------------------ money ledger (other incomes and expenses)
create table if not exists public.moloko_money (
  id          uuid primary key default gen_random_uuid(),
  date        date not null default (now() at time zone 'Asia/Almaty')::date,
  kind        text not null check (kind in ('income','expense')),
  category    text not null default 'Другое',
  amount      integer not null check (amount > 0),
  method      text not null default 'kaspi',
  note        text not null default '',
  booking_id  uuid references public.moloko_bookings(id) on delete set null,
  cert_id     uuid,
  demo        boolean not null default false,
  created_at  timestamptz not null default now(),
  created_by  uuid default auth.uid()
);
create index if not exists moloko_money_date_idx on public.moloko_money (date);
alter table public.moloko_money enable row level security;
drop policy if exists moloko_money_all on public.moloko_money;
create policy moloko_money_all on public.moloko_money for all to authenticated
  using (public.moloko_has(array['owner','accountant'])) with check (public.moloko_has(array['owner','accountant']));
grant select, insert, update, delete on public.moloko_money to authenticated;

-- ------------------------------------------------------------------ gift certificates and passes (абонементы)
create table if not exists public.moloko_certs (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique,
  kind        text not null check (kind in ('certificate','pass')),
  title       text not null default '',
  phone       text not null default '',
  name        text not null default '',
  amount      integer not null default 0 check (amount >= 0),   -- money value (certificate)
  hours       integer not null default 0 check (hours >= 0),    -- hours (pass)
  price       integer not null default 0 check (price >= 0),    -- what the buyer paid
  uses        jsonb not null default '[]'::jsonb,               -- [{at, amount, hours, booking_id, by}]
  status      text not null default 'active' check (status in ('active','used','expired','void')),
  expires     date,
  note        text not null default '',
  created_at  timestamptz not null default now(),
  created_by  uuid default auth.uid()
);
alter table public.moloko_certs enable row level security;
drop policy if exists moloko_certs_read on public.moloko_certs;
drop policy if exists moloko_certs_write on public.moloko_certs;
drop policy if exists moloko_certs_update on public.moloko_certs;
drop policy if exists moloko_certs_delete on public.moloko_certs;
create policy moloko_certs_read on public.moloko_certs for select to authenticated using (public.moloko_has(array['owner','accountant','admin']));
create policy moloko_certs_write on public.moloko_certs for insert to authenticated with check (public.moloko_has(array['owner','accountant','admin']));
create policy moloko_certs_update on public.moloko_certs for update to authenticated
  using (public.moloko_has(array['owner','accountant','admin'])) with check (public.moloko_has(array['owner','accountant','admin']));
create policy moloko_certs_delete on public.moloko_certs for delete to authenticated using (public.moloko_has(array['owner']));
grant select, insert, update, delete on public.moloko_certs to authenticated;

-- ------------------------------------------------------------------ bonus kinds: referral reward and certificate top-ups
alter table public.moloko_bonus_tx drop constraint if exists moloko_bonus_tx_kind_check;
alter table public.moloko_bonus_tx add constraint moloko_bonus_tx_kind_check
  check (kind in ('accrual','redeem','manual','welcome','referral'));

-- ------------------------------------------------------------------ client accounts (widget login) and referral codes
alter table public.moloko_clients add column if not exists ref_code text unique;
alter table public.moloko_clients add column if not exists ref_by text;

create or replace function public.moloko_gen_code(n int default 6) returns text
language sql volatile set search_path = public as $$
  select string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 1 + floor(random() * 32)::int, 1), '') from generate_series(1, n);
$$;
create or replace function public.moloko_clients_code() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.ref_code is null then
    loop
      new.ref_code := public.moloko_gen_code(6);
      exit when not exists (select 1 from public.moloko_clients where ref_code = new.ref_code);
    end loop;
  end if;
  return new;
end $$;
drop trigger if exists moloko_clients_code on public.moloko_clients;
create trigger moloko_clients_code before insert on public.moloko_clients for each row execute function public.moloko_clients_code();
update public.moloko_clients set ref_code = public.moloko_gen_code(6) where ref_code is null;

create table if not exists public.moloko_accounts (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  phone       text not null unique references public.moloko_clients(phone) on update cascade on delete cascade,
  verified    boolean not null default false,
  created_at  timestamptz not null default now()
);
alter table public.moloko_accounts enable row level security;
drop policy if exists moloko_accounts_staff on public.moloko_accounts;
create policy moloko_accounts_staff on public.moloko_accounts for select to authenticated using (public.moloko_is_staff());
drop policy if exists moloko_accounts_verify on public.moloko_accounts;
create policy moloko_accounts_verify on public.moloko_accounts for update to authenticated
  using (public.moloko_has(array['owner','admin'])) with check (public.moloko_has(array['owner','admin']));
grant select, update on public.moloko_accounts to authenticated;

-- ------------------------------------------------------------------ catalogue helpers (prices and halls now live in settings)
create or replace function public.moloko_hall_ok(s jsonb, p_hall text) returns boolean
language sql immutable set search_path = public as $$
  select case
    when s ? 'catalog' and jsonb_typeof(s->'catalog'->'halls') = 'array' then exists (
      select 1 from jsonb_array_elements(s->'catalog'->'halls') h where h->>'id' = p_hall and coalesce((h->>'enabled')::boolean, true))
    else p_hall in ('white','beige','grey','black') end;
$$;
create or replace function public.moloko_no_confetti(s jsonb, p_hall text) returns boolean
language sql immutable set search_path = public as $$
  select case
    when s ? 'catalog' and jsonb_typeof(s->'catalog'->'halls') = 'array' then exists (
      select 1 from jsonb_array_elements(s->'catalog'->'halls') h where h->>'id' = p_hall and coalesce((h->>'noConfetti')::boolean, false))
    else p_hall = 'grey' end;
$$;

-- Price on the server (night window and every rate come from settings)
create or replace function public.moloko_quote(p_hall text, p_start int, p_hours int, p_guests int, p_equip text[], p_confetti boolean)
returns integer language plpgsql stable security definer set search_path = public as $$
declare
  s jsonb; total int; nights int := 0; k int; h int; e text; n_from int; n_to int;
begin
  select data into s from public.moloko_settings where id = 1;
  n_from := coalesce((s->'booking'->>'nightFrom')::int, 21);
  n_to := coalesce((s->'booking'->>'nightTo')::int, 9);
  total := coalesce((s->'halls'->>p_hall)::int, 0) * p_hours;
  for k in 0 .. p_hours - 1 loop
    h := (p_start + k) % 24;
    if h >= n_from or h < n_to then nights := nights + 1; end if;
  end loop;
  total := total + nights * coalesce((s->>'night')::int, 0);
  total := total + greatest(0, p_guests - coalesce((s->>'freeGuests')::int, 6)) * p_hours * coalesce((s->>'guest')::int, 0);
  foreach e in array coalesce(p_equip, '{}') loop
    total := total + coalesce((s->'equip'->>e)::int, 0) * p_hours;
  end loop;
  if p_confetti then total := total + coalesce((s->>'confetti')::int, 0); end if;
  return total;
end $$;

-- Is a referral code valid for this phone (not its own, and the phone has never booked before)?
create or replace function public.moloko_ref_owner(p_code text, p_phone text) returns text
language sql stable security definer set search_path = public as $$
  select c.phone from public.moloko_clients c
  where c.ref_code = upper(btrim(p_code)) and c.phone <> p_phone and not c.blocked
    and not exists (select 1 from public.moloko_bookings b where b.phone_norm = p_phone and b.status in ('paid','done'))
  limit 1;
$$;

-- Public: what a referral link gives (for the widget banner)
create or replace function public.moloko_ref_info(p_code text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_name text; s jsonb;
begin
  select name into v_name from public.moloko_clients where ref_code = upper(btrim(p_code)) and not blocked;
  if not found then return null; end if;
  select data->'referral' into s from public.moloko_settings where id = 1;
  if not coalesce((s->>'enabled')::boolean, true) then return null; end if;
  return jsonb_build_object('name', split_part(v_name, ' ', 1), 'pct', coalesce((s->>'friendPct')::int, 5));
end $$;

-- ------------------------------------------------------------------ widget booking v3: one or several halls, referral, account
create or replace function public.moloko_book(p jsonb) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  s jsonb;
  v_items jsonb := coalesce(p->'items', jsonb_build_array(jsonb_build_object('hall', p->>'hall', 'date', p->>'date', 'start', p->>'start', 'hours', p->>'hours')));
  v_guests int := coalesce((p->>'guests')::int, 1);
  v_equip text[] := coalesce(array(select jsonb_array_elements_text(p->'equip')), '{}');
  v_confetti boolean := coalesce((p->>'confetti')::boolean, false);
  v_name text := btrim(coalesce(p->>'name', ''));
  v_phone text := btrim(coalesce(p->>'phone', ''));
  v_norm text := public.moloko_norm_phone(p->>'phone');
  v_bonus int := greatest(0, coalesce((p->>'bonus')::int, 0));
  v_local timestamp := now() at time zone 'Asia/Almaty';
  v_group uuid := case when jsonb_array_length(coalesce(p->'items', '[]'::jsonb)) > 1 then gen_random_uuid() else null end;
  v_ref text; v_ref_pct int := 0; v_acc uuid; v_acc_phone text;
  it jsonb; v_hall text; v_date date; v_start int; v_hours int;
  v_base int; v_disc int; v_tot int; v_sum int := 0; v_bonus_left int; v_b int; v_id uuid; v_ids uuid[] := '{}';
  v_bal int; v_max int; v_open int; v_close int; v_minh int; v_maxh int; v_days int; v_lead int; k int;
begin
  select data into s from public.moloko_settings where id = 1;
  v_open := coalesce((s->'booking'->>'open')::int, 0);
  v_close := coalesce((s->'booking'->>'close')::int, 24);
  v_minh := coalesce((s->'booking'->>'minHours')::int, 1);
  v_maxh := coalesce((s->'booking'->>'maxHours')::int, 12);
  v_days := coalesce((s->'booking'->>'daysAhead')::int, 90);
  v_lead := coalesce((s->'booking'->>'leadHours')::int, 0);

  if jsonb_typeof(v_items) <> 'array' or jsonb_array_length(v_items) not between 1 and 6 then raise exception 'bad_items'; end if;
  if v_guests not between 1 and 40 then raise exception 'bad_guests'; end if;
  if char_length(v_name) not between 2 and 80 then raise exception 'bad_name'; end if;
  if v_norm !~ '^\d{11,15}$' then raise exception 'bad_phone'; end if;
  if exists (select 1 from unnest(v_equip) e where not (coalesce(s->'equip', '{}'::jsonb) ? e)) then raise exception 'bad_equip'; end if;
  if exists (select 1 from public.moloko_clients where phone = v_norm and blocked) then raise exception 'blocked'; end if;
  if (select count(*) from public.moloko_bookings
      where phone_norm = v_norm and status = 'new' and created_at > now() - interval '1 day') >= 8 then
    raise exception 'too_many';
  end if;

  -- signed-in client: link the booking to their account (phone must match)
  if auth.uid() is not null then
    select user_id, phone into v_acc, v_acc_phone from public.moloko_accounts where user_id = auth.uid();
    if v_acc is not null and v_acc_phone <> v_norm then v_acc := null; end if;
  end if;

  -- referral discount for a friend's first booking
  if coalesce(p->>'ref', '') <> '' and coalesce((s->'referral'->>'enabled')::boolean, true) then
    v_ref := public.moloko_ref_owner(p->>'ref', v_norm);
    if v_ref is not null then v_ref_pct := coalesce((s->'referral'->>'friendPct')::int, 5); end if;
  end if;

  insert into public.moloko_clients (phone, name) values (v_norm, v_name) on conflict (phone) do nothing;
  if v_ref is not null then update public.moloko_clients set ref_by = coalesce(ref_by, v_ref) where phone = v_norm; end if;

  -- bonus cap is calculated on the whole order
  if v_bonus > 0 then
    select coalesce(sum(amount), 0) into v_bal from public.moloko_bonus_tx where phone = v_norm;
  end if;
  v_bonus_left := 0;

  for k in 0 .. jsonb_array_length(v_items) - 1 loop
    it := v_items->k;
    v_hall := it->>'hall'; v_date := (it->>'date')::date; v_start := (it->>'start')::int; v_hours := (it->>'hours')::int;
    if not public.moloko_hall_ok(s, v_hall) then raise exception 'bad_hall'; end if;
    if v_start not between 0 and 23 or v_hours not between v_minh and v_maxh then raise exception 'bad_time'; end if;
    if v_start < v_open or (v_close < 24 and v_start + v_hours > v_close) then raise exception 'bad_time'; end if;
    if v_date + make_interval(hours => v_start) <= v_local + make_interval(hours => v_lead) then raise exception 'past'; end if;
    if v_date > v_local::date + v_days then raise exception 'too_far'; end if;
    if v_confetti and public.moloko_no_confetti(s, v_hall) then raise exception 'no_confetti_in_grey'; end if;
  end loop;

  for k in 0 .. jsonb_array_length(v_items) - 1 loop
    it := v_items->k;
    v_hall := it->>'hall'; v_date := (it->>'date')::date; v_start := (it->>'start')::int; v_hours := (it->>'hours')::int;
    -- extras (guests, equipment, confetti) are charged once, on the first part of the order
    v_base := public.moloko_quote(v_hall, v_start, v_hours, case when k = 0 then v_guests else 1 end, case when k = 0 then v_equip else '{}' end, k = 0 and v_confetti);
    v_disc := floor(v_base * v_ref_pct / 100);
    v_tot := v_base - v_disc;
    v_sum := v_sum + v_tot;
    begin
      insert into public.moloko_bookings (hall, date, start_hour, hours, status, name, phone, total, bonus_used, source, group_id, extra)
      values (v_hall, v_date, v_start, v_hours, 'new', v_name, v_phone, v_tot, 0, 'Виджет', v_group,
        jsonb_build_object(
          'guests', v_guests, 'equip', to_jsonb(case when k = 0 then v_equip else '{}'::text[] end),
          'makeup', coalesce((p->>'makeup')::boolean, false),
          'confetti', k = 0 and v_confetti,
          'pet', coalesce((p->>'pet')::boolean, false),
          'kind', left(coalesce(p->>'kind', ''), 60),
          'comment', left(coalesce(p->>'comment', ''), 500),
          'fines', '[]'::jsonb,
          'listTotal', v_base, 'discount', v_disc,
          'ref', v_ref, 'refPct', nullif(v_ref_pct, 0),
          'account', v_acc))
      returning id into v_id;
    exception when exclusion_violation then
      raise exception 'slot_taken';
    end;
    v_ids := v_ids || v_id;
  end loop;

  -- spread the redeemed bonus over the parts, respecting the per-order cap
  if v_bonus > 0 then
    v_max := floor(v_sum * coalesce((s->'loyalty'->>'maxRedeemPct')::numeric, 30) / 100);
    v_bonus := least(v_bonus, v_bal, v_max);
    v_bonus_left := v_bonus;
    for k in 1 .. array_length(v_ids, 1) loop
      exit when v_bonus_left <= 0;
      select least(v_bonus_left, total) into v_b from public.moloko_bookings where id = v_ids[k];
      update public.moloko_bookings set bonus_used = v_b where id = v_ids[k];
      v_bonus_left := v_bonus_left - v_b;
    end loop;
  end if;

  return jsonb_build_object('id', v_ids[1], 'ids', to_jsonb(v_ids), 'group', v_group, 'total', v_sum,
    'bonus', coalesce(v_bonus, 0), 'pay', v_sum - coalesce(v_bonus, 0), 'discount', v_ref_pct);
end $$;

-- ------------------------------------------------------------------ referral reward + account verification on payment
create or replace function public.moloko_sync_bonus(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  b public.moloko_bookings; v_acc int; v_red int; v_want_red int; v_lvl jsonb; v_amt int; s jsonb; v_ref text; v_rr int; v_have int;
begin
  select * into b from public.moloko_bookings where id = p_id;
  if not found or b.phone_norm !~ '^\d{10,15}$' or b.status = 'block' then return; end if;
  insert into public.moloko_clients (phone, name) values (b.phone_norm, b.name) on conflict (phone) do nothing;

  select coalesce(sum(amount) filter (where kind = 'accrual'), 0), coalesce(sum(amount) filter (where kind = 'redeem'), 0),
         coalesce(sum(amount) filter (where kind = 'referral'), 0)
    into v_acc, v_red, v_have from public.moloko_bonus_tx where booking_id = p_id;

  v_want_red := case when b.status in ('paid','done') then -b.bonus_used else 0 end;
  if v_want_red <> v_red then
    insert into public.moloko_bonus_tx (phone, amount, kind, booking_id, note, created_by)
    values (b.phone_norm, v_want_red - v_red, 'redeem', p_id,
            case when v_want_red - v_red < 0 then 'Оплата бонусами' else 'Возврат бонусов' end, auth.uid());
  end if;

  if b.status = 'done' and v_acc = 0 then
    v_lvl := public.moloko_client_level(b.phone_norm, p_id);
    if coalesce((v_lvl->>'enabled')::boolean, true) then
      v_amt := floor(greatest(0, b.total - b.bonus_used) * coalesce((v_lvl->>'pct')::numeric, 0) / 100);
      if v_amt > 0 then
        insert into public.moloko_bonus_tx (phone, amount, kind, booking_id, note, created_by)
        values (b.phone_norm, v_amt, 'accrual', p_id, 'Начислено за съёмку · ' || (v_lvl->>'name') || ' ' || (v_lvl->>'pct') || '%', auth.uid());
      end if;
    end if;
  elsif b.status <> 'done' and v_acc <> 0 then
    insert into public.moloko_bonus_tx (phone, amount, kind, booking_id, note, created_by)
    values (b.phone_norm, -v_acc, 'accrual', p_id, 'Отмена начисления', auth.uid());
  end if;

  -- the friend who shared the link gets a bonus when this shoot is done
  v_ref := b.extra->>'ref';
  if v_ref is not null and v_ref <> b.phone_norm then
    select data->'referral' into s from public.moloko_settings where id = 1;
    v_rr := floor(greatest(0, b.total - b.bonus_used) * coalesce((s->>'referrerPct')::numeric, 5) / 100);
    if b.status = 'done' and v_have = 0 and v_rr > 0 and exists (select 1 from public.moloko_clients where phone = v_ref) then
      insert into public.moloko_bonus_tx (phone, amount, kind, booking_id, note, created_by)
      values (v_ref, v_rr, 'referral', p_id, 'Друг пришёл по вашей ссылке: ' || split_part(b.name, ' ', 1), auth.uid());
    elsif b.status <> 'done' and v_have <> 0 then
      insert into public.moloko_bonus_tx (phone, amount, kind, booking_id, note, created_by)
      values (v_ref, -v_have, 'referral', p_id, 'Отмена реферального бонуса', auth.uid());
    end if;
  end if;

  -- a paid booking made from a client account proves the phone belongs to that person
  if b.status in ('paid','done') and (b.extra->>'account') is not null then
    update public.moloko_accounts set verified = true where user_id = (b.extra->>'account')::uuid and phone = b.phone_norm and not verified;
  end if;
end $$;

-- ------------------------------------------------------------------ client cabinet (widget, signed in)
create or replace function public.moloko_me() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare a public.moloko_accounts; c public.moloko_clients; v_lvl jsonb; s jsonb; v_bal int; v_next jsonb; v_cur int;
begin
  select * into a from public.moloko_accounts where user_id = auth.uid();
  if not found then return null; end if;
  select * into c from public.moloko_clients where phone = a.phone;
  select data into s from public.moloko_settings where id = 1;
  v_lvl := public.moloko_client_level(a.phone);
  select coalesce(sum(amount), 0) into v_bal from public.moloko_bonus_tx where phone = a.phone;
  v_cur := case when coalesce(s->'loyalty'->>'basis', 'hours') = 'spent' then (v_lvl->>'spent')::int else (v_lvl->>'hours')::int end;
  select l into v_next from jsonb_array_elements(coalesce(s->'loyalty'->'levels', '[]'::jsonb)) l
    where (l->>'from')::int > v_cur order by (l->>'from')::int limit 1;
  return jsonb_build_object(
    'phone', a.phone, 'name', c.name, 'verified', a.verified, 'refCode', c.ref_code,
    'level', v_lvl, 'next', v_next, 'basis', coalesce(s->'loyalty'->>'basis', 'hours'),
    'balance', case when a.verified then v_bal else null end,
    'friendPct', coalesce((s->'referral'->>'friendPct')::int, 5), 'referrerPct', coalesce((s->'referral'->>'referrerPct')::int, 5),
    'friends', (select count(*) from public.moloko_clients where ref_by = a.phone),
    'tx', case when a.verified then coalesce((select jsonb_agg(jsonb_build_object('amount', amount, 'kind', kind, 'note', note, 'at', created_at) order by created_at desc)
             from (select * from public.moloko_bonus_tx where phone = a.phone order by created_at desc limit 50) t), '[]'::jsonb) else '[]'::jsonb end,
    'bookings', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'hall', hall, 'date', date, 'start', start_hour, 'hours', hours,
             'status', status, 'total', total, 'bonus', bonus_used, 'group', group_id) order by date desc, start_hour desc)
             from public.moloko_bookings
             where status <> 'block' and phone_norm = a.phone and (a.verified or extra->>'account' = a.user_id::text)), '[]'::jsonb));
end $$;

-- ------------------------------------------------------------------ public invitation card (no names or phones)
create or replace function public.moloko_invite(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare b public.moloko_bookings; v jsonb;
begin
  select * into b from public.moloko_bookings where id = p_id and status in ('new','paid','done');
  if not found then return null; end if;
  select jsonb_agg(jsonb_build_object('hall', hall, 'date', date, 'start', start_hour, 'hours', hours) order by date, start_hour) into v
    from public.moloko_bookings
    where (id = p_id or (b.group_id is not null and group_id = b.group_id)) and status in ('new','paid','done');
  return jsonb_build_object('items', v, 'kind', b.extra->>'kind', 'guests', (b.extra->>'guests')::int, 'host', split_part(b.name, ' ', 1));
end $$;

-- ------------------------------------------------------------------ grants
revoke all on function public.moloko_role(), public.moloko_has(text[]), public.moloko_settings_guard(),
  public.moloko_clients_code(), public.moloko_gen_code(int), public.moloko_ref_owner(text, text),
  public.moloko_hall_ok(jsonb, text), public.moloko_no_confetti(jsonb, text), public.moloko_sync_bonus(uuid) from public, anon;
grant execute on function public.moloko_role(), public.moloko_has(text[]) to authenticated;
grant execute on function public.moloko_book(jsonb), public.moloko_ref_info(text), public.moloko_invite(uuid), public.moloko_quote(text, int, int, int, text[], boolean) to anon, authenticated;
grant execute on function public.moloko_me() to authenticated;

do $$
declare t text;
begin
  foreach t in array array['moloko_requests','moloko_money','moloko_certs'] loop
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- ===================== 20261118050000_moloko_media.sql
-- Public bucket for hall photos and videos shown in the widget; owner and SMM upload.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('moloko-media', 'moloko-media', true, 52428800,
        array['image/jpeg','image/png','image/webp','image/avif','video/mp4','video/webm','video/quicktime'])
on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists moloko_media_read on storage.objects;
drop policy if exists moloko_media_insert on storage.objects;
drop policy if exists moloko_media_update on storage.objects;
drop policy if exists moloko_media_delete on storage.objects;
create policy moloko_media_read on storage.objects for select to anon, authenticated using (bucket_id = 'moloko-media');
create policy moloko_media_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'moloko-media' and public.moloko_has(array['owner','smm']));
create policy moloko_media_update on storage.objects for update to authenticated
  using (bucket_id = 'moloko-media' and public.moloko_has(array['owner','smm']));
create policy moloko_media_delete on storage.objects for delete to authenticated
  using (bucket_id = 'moloko-media' and public.moloko_has(array['owner','smm']));

commit;
