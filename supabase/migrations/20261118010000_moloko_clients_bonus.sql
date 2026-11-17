-- Clients, bonus ledger (by phone number) and audit log.

-- Normalised phone: digits only, Kazakh 8XXXXXXXXXX -> 7XXXXXXXXXX
create or replace function public.moloko_norm_phone(p text) returns text
language sql immutable set search_path = public as $$
  select case
    when d ~ '^8\d{10}$' then '7' || substr(d, 2)
    when d ~ '^\d{10}$' then '7' || d
    else d end
  from (select regexp_replace(coalesce(p, ''), '\D', '', 'g') as d) x;
$$;

alter table public.moloko_bookings
  add column if not exists phone_norm text generated always as (public.moloko_norm_phone(phone)) stored,
  add column if not exists bonus_used integer not null default 0 check (bonus_used >= 0);
create index if not exists moloko_bookings_phone_norm_idx on public.moloko_bookings (phone_norm);

create table if not exists public.moloko_clients (
  phone      text primary key check (phone ~ '^\d{10,15}$'),
  name       text not null default '',
  note       text not null default '',
  tags       text[] not null default '{}',
  birthday   date,
  blocked    boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.moloko_bonus_tx (
  id         uuid primary key default gen_random_uuid(),
  phone      text not null references public.moloko_clients(phone) on update cascade on delete cascade,
  amount     integer not null check (amount <> 0),
  kind       text not null check (kind in ('accrual','redeem','manual','welcome')),
  booking_id uuid references public.moloko_bookings(id) on delete set null,
  note       text not null default '',
  created_at timestamptz not null default now(),
  created_by uuid
);
create index if not exists moloko_bonus_tx_phone_idx on public.moloko_bonus_tx (phone);
create index if not exists moloko_bonus_tx_booking_idx on public.moloko_bonus_tx (booking_id);

create table if not exists public.moloko_audit (
  id         bigint generated always as identity primary key,
  at         timestamptz not null default now(),
  actor      uuid,
  action     text not null,
  booking_id uuid,
  summary    text not null default '',
  data       jsonb
);
create index if not exists moloko_audit_at_idx on public.moloko_audit (at desc);

-- loyalty programme defaults (merged into settings if missing)
update public.moloko_settings set data = data || jsonb_build_object('loyalty', jsonb_build_object(
  'enabled', true,
  'basis', 'hours',
  'levels', jsonb_build_array(
    jsonb_build_object('id','milk', 'name','Milk', 'pct',3,'from',0),
    jsonb_build_object('id','cream','name','Cream','pct',5,'from',20),
    jsonb_build_object('id','gold', 'name','Gold', 'pct',8,'from',60)),
  'maxRedeemPct', 30,
  'welcome', 0))
where id = 1 and (data->'loyalty'->'levels') is null;

-- ------------------------------------------------------------------ loyalty helpers
-- Completed hours / spend of a client (excluding one booking, to price that booking at the level reached before it)
create or replace function public.moloko_client_level(p_phone text, p_except uuid default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  s jsonb; lvl jsonb; best jsonb; v_hours int; v_spent int; v_basis text; v_val int;
begin
  select data->'loyalty' into s from public.moloko_settings where id = 1;
  select coalesce(sum(hours),0), coalesce(sum(total),0) into v_hours, v_spent
    from public.moloko_bookings
    where phone_norm = p_phone and status = 'done' and (p_except is null or id <> p_except);
  v_basis := coalesce(s->>'basis', 'hours');
  v_val := case when v_basis = 'spent' then v_spent else v_hours end;
  for lvl in select * from jsonb_array_elements(coalesce(s->'levels', '[]'::jsonb)) loop
    if v_val >= coalesce((lvl->>'from')::int, 0) and (best is null or (lvl->>'from')::int >= (best->>'from')::int) then best := lvl; end if;
  end loop;
  return coalesce(best, '{"id":"milk","name":"Milk","pct":0,"from":0}'::jsonb)
    || jsonb_build_object('hours', v_hours, 'spent', v_spent, 'enabled', coalesce((s->>'enabled')::boolean, true));
end $$;

-- Bring a booking's bonus ledger in line with its status (idempotent).
create or replace function public.moloko_sync_bonus(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  b public.moloko_bookings; v_acc int; v_red int; v_want_red int; v_lvl jsonb; v_amt int;
begin
  select * into b from public.moloko_bookings where id = p_id;
  if not found or b.phone_norm !~ '^\d{10,15}$' or b.status = 'block' then return; end if;
  insert into public.moloko_clients (phone, name) values (b.phone_norm, b.name) on conflict (phone) do nothing;

  select coalesce(sum(amount) filter (where kind = 'accrual'), 0), coalesce(sum(amount) filter (where kind = 'redeem'), 0)
    into v_acc, v_red from public.moloko_bonus_tx where booking_id = p_id;

  -- redemption is applied once the booking is paid
  v_want_red := case when b.status in ('paid','done') then -b.bonus_used else 0 end;
  if v_want_red <> v_red then
    insert into public.moloko_bonus_tx (phone, amount, kind, booking_id, note, created_by)
    values (b.phone_norm, v_want_red - v_red, 'redeem', p_id,
            case when v_want_red - v_red < 0 then 'Оплата бонусами' else 'Возврат бонусов' end, auth.uid());
  end if;

  -- accrual after the shoot
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
end $$;

create or replace function public.moloko_bookings_after() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_sum text;
begin
  if tg_op = 'DELETE' then
    insert into public.moloko_audit (actor, action, booking_id, summary, data)
    values (auth.uid(), 'delete', old.id, old.name || ' · ' || old.hall || ' ' || old.date || ' ' || old.start_hour || ':00', to_jsonb(old) - 'span');
    return old;
  end if;
  if new.status <> 'block' and new.phone_norm ~ '^\d{10,15}$' then
    insert into public.moloko_clients (phone, name) values (new.phone_norm, new.name)
    on conflict (phone) do update set name = case when public.moloko_clients.name = '' then excluded.name else public.moloko_clients.name end;
    if tg_op = 'INSERT' or new.status is distinct from old.status or new.bonus_used is distinct from old.bonus_used or new.total is distinct from old.total then
      perform public.moloko_sync_bonus(new.id);
    end if;
  end if;
  v_sum := new.name || ' · ' || upper(new.hall) || ' ' || to_char(new.date, 'DD.MM') || ' ' || lpad(new.start_hour::text, 2, '0') || ':00';
  if tg_op = 'INSERT' then
    insert into public.moloko_audit (actor, action, booking_id, summary) values (auth.uid(), 'create:' || new.status, new.id, v_sum);
  elsif new.status is distinct from old.status then
    insert into public.moloko_audit (actor, action, booking_id, summary) values (auth.uid(), 'status:' || new.status, new.id, v_sum);
  elsif new.date is distinct from old.date or new.start_hour is distinct from old.start_hour or new.hall is distinct from old.hall or new.hours is distinct from old.hours then
    insert into public.moloko_audit (actor, action, booking_id, summary) values (auth.uid(), 'move', new.id, v_sum);
  end if;
  return new;
end $$;

create trigger moloko_bookings_after after insert or update or delete on public.moloko_bookings
  for each row execute function public.moloko_bookings_after();


create trigger moloko_clients_touch before update on public.moloko_clients
  for each row execute function public.moloko_touch();

-- ------------------------------------------------------------------ RLS
alter table public.moloko_clients  enable row level security;
alter table public.moloko_bonus_tx enable row level security;
alter table public.moloko_audit    enable row level security;

create policy moloko_clients_staff on public.moloko_clients for all to authenticated
  using (public.moloko_is_staff()) with check (public.moloko_is_staff());
create policy moloko_bonus_read on public.moloko_bonus_tx for select to authenticated using (public.moloko_is_staff());
-- staff may add manual corrections only; accruals/redemptions come from the trigger
create policy moloko_bonus_manual on public.moloko_bonus_tx for insert to authenticated
  with check (public.moloko_is_staff() and kind = 'manual' and created_by = auth.uid());
create policy moloko_audit_read on public.moloko_audit for select to authenticated using (public.moloko_is_owner());

revoke all on public.moloko_clients, public.moloko_bonus_tx, public.moloko_audit from anon;
grant select, insert, update on public.moloko_clients to authenticated;
grant select, insert on public.moloko_bonus_tx to authenticated;
grant select on public.moloko_audit to authenticated;

-- ------------------------------------------------------------------ public: bonus balance by phone (widget)
create or replace function public.moloko_bonus(p_phone text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_phone text := public.moloko_norm_phone(p_phone); v_bal int; v_lvl jsonb;
begin
  if v_phone !~ '^\d{11,15}$' then return null; end if;
  if not exists (select 1 from public.moloko_clients where phone = v_phone and not blocked) then return null; end if;
  select coalesce(sum(amount), 0) into v_bal from public.moloko_bonus_tx where phone = v_phone;
  v_lvl := public.moloko_client_level(v_phone);
  return jsonb_build_object('balance', v_bal, 'level', v_lvl->>'name', 'pct', (v_lvl->>'pct')::int, 'hours', (v_lvl->>'hours')::int);
end $$;

-- ------------------------------------------------------------------ widget booking v2: bonus use
create or replace function public.moloko_book(p jsonb) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  v_hall text := p->>'hall';
  v_date date := (p->>'date')::date;
  v_start int := (p->>'start')::int;
  v_hours int := (p->>'hours')::int;
  v_guests int := coalesce((p->>'guests')::int, 1);
  v_equip text[] := coalesce(array(select jsonb_array_elements_text(p->'equip')), '{}');
  v_confetti boolean := coalesce((p->>'confetti')::boolean, false);
  v_name text := btrim(coalesce(p->>'name', ''));
  v_phone text := btrim(coalesce(p->>'phone', ''));
  v_norm text := public.moloko_norm_phone(p->>'phone');
  v_bonus int := greatest(0, coalesce((p->>'bonus')::int, 0));
  v_local timestamp := now() at time zone 'Asia/Almaty';
  v_total int; v_id uuid; v_bal int; v_max int; s jsonb;
begin
  if v_hall not in ('white','beige','grey','black') then raise exception 'bad_hall'; end if;
  if v_start not between 0 and 23 or v_hours not between 1 and 12 then raise exception 'bad_time'; end if;
  if v_date + make_interval(hours => v_start) <= v_local then raise exception 'past'; end if;
  if v_date > v_local::date + 90 then raise exception 'too_far'; end if;
  if v_guests not between 1 and 40 then raise exception 'bad_guests'; end if;
  if char_length(v_name) not between 2 and 80 then raise exception 'bad_name'; end if;
  if v_norm !~ '^\d{11,15}$' then raise exception 'bad_phone'; end if;
  if v_confetti and v_hall = 'grey' then raise exception 'no_confetti_in_grey'; end if;
  if exists (select 1 from unnest(v_equip) e where e not in ('light','smoke','snow','proj','laser','gobo_j','gobo_a','jedi','rgb','tripod')) then
    raise exception 'bad_equip';
  end if;
  if exists (select 1 from public.moloko_clients where phone = v_norm and blocked) then raise exception 'blocked'; end if;
  if (select count(*) from public.moloko_bookings
      where phone_norm = v_norm and status = 'new' and created_at > now() - interval '1 day') >= 3 then
    raise exception 'too_many';
  end if;

  v_total := public.moloko_quote(v_hall, v_start, v_hours, v_guests, v_equip, v_confetti);

  if v_bonus > 0 then
    select data->'loyalty' into s from public.moloko_settings where id = 1;
    select coalesce(sum(amount), 0) into v_bal from public.moloko_bonus_tx where phone = v_norm;
    v_max := floor(v_total * coalesce((s->>'maxRedeemPct')::numeric, 30) / 100);
    v_bonus := least(v_bonus, v_bal, v_max);
  end if;

  begin
    insert into public.moloko_bookings (hall, date, start_hour, hours, status, name, phone, total, bonus_used, source, extra)
    values (v_hall, v_date, v_start, v_hours, 'new', v_name, v_phone, v_total, v_bonus, 'Виджет',
      jsonb_build_object(
        'guests', v_guests, 'equip', to_jsonb(v_equip),
        'makeup', coalesce((p->>'makeup')::boolean, false),
        'confetti', v_confetti,
        'pet', coalesce((p->>'pet')::boolean, false),
        'kind', left(coalesce(p->>'kind', ''), 60),
        'comment', left(coalesce(p->>'comment', ''), 500),
        'fines', '[]'::jsonb))
    returning id into v_id;
  exception when exclusion_violation then
    raise exception 'slot_taken';
  end;
  return jsonb_build_object('id', v_id, 'total', v_total, 'bonus', v_bonus, 'pay', v_total - v_bonus);
end $$;

revoke all on function public.moloko_bonus(text), public.moloko_client_level(text, uuid), public.moloko_sync_bonus(uuid),
  public.moloko_norm_phone(text), public.moloko_bookings_after() from public, anon;
grant execute on function public.moloko_bonus(text), public.moloko_book(jsonb) to anon, authenticated;
grant execute on function public.moloko_client_level(text, uuid), public.moloko_norm_phone(text) to authenticated;

alter publication supabase_realtime add table public.moloko_clients, public.moloko_bonus_tx;
