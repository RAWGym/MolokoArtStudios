-- Moloko Art Studios: booking widget + studio CRM
-- All objects are prefixed with moloko_ so the schema can live next to other apps.

create extension if not exists btree_gist;

-- ------------------------------------------------------------------ tables
create table if not exists public.moloko_staff (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  login      text not null unique check (login ~ '^[a-z0-9._-]{3,32}$'),
  name       text not null check (char_length(name) between 1 and 80),
  role       text not null check (role in ('owner','admin')),
  disabled   boolean not null default false,
  created_at timestamptz not null default now(),
  created_by uuid
);

create table if not exists public.moloko_settings (
  id         smallint primary key default 1 check (id = 1),
  data       jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid
);

create table if not exists public.moloko_bookings (
  id         uuid primary key default gen_random_uuid(),
  hall       text not null check (hall in ('white','beige','grey','black')),
  date       date not null,
  start_hour smallint not null check (start_hour between 0 and 23),
  hours      smallint not null check (hours between 1 and 24),
  span       tsrange generated always as (
               tsrange(date + make_interval(hours => start_hour),
                       date + make_interval(hours => start_hour + hours))
             ) stored,
  status     text not null default 'new' check (status in ('new','paid','done','cancelled','block')),
  name       text not null default '',
  phone      text not null default '',
  total      integer not null default 0,
  source     text,
  demo       boolean not null default false,
  extra      jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  created_by uuid,
  updated_at timestamptz not null default now(),
  -- one hall cannot be booked twice for overlapping hours (cancelled ones don't count)
  constraint moloko_no_overlap exclude using gist (hall with =, span with &&) where (status <> 'cancelled')
);
create index if not exists moloko_bookings_date_idx on public.moloko_bookings (date);
create index if not exists moloko_bookings_phone_idx on public.moloko_bookings (phone);

create or replace function public.moloko_touch() returns trigger language plpgsql set search_path = public as $$
begin new.updated_at := now(); return new; end $$;
drop trigger if exists moloko_bookings_touch on public.moloko_bookings;
create trigger moloko_bookings_touch before update on public.moloko_bookings
  for each row execute function public.moloko_touch();

-- ------------------------------------------------------------------ role helpers
create or replace function public.moloko_is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.moloko_staff where user_id = auth.uid() and not disabled);
$$;
create or replace function public.moloko_is_owner() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.moloko_staff where user_id = auth.uid() and not disabled and role = 'owner');
$$;

-- ------------------------------------------------------------------ RLS
alter table public.moloko_staff    enable row level security;
alter table public.moloko_settings enable row level security;
alter table public.moloko_bookings enable row level security;

drop policy if exists moloko_staff_read on public.moloko_staff;
create policy moloko_staff_read on public.moloko_staff for select to authenticated
  using (public.moloko_is_staff() or user_id = auth.uid());
-- staff rows are written only by the moloko-staff edge function (service role)

drop policy if exists moloko_settings_read on public.moloko_settings;
create policy moloko_settings_read on public.moloko_settings for select to anon, authenticated using (true);
drop policy if exists moloko_settings_write on public.moloko_settings;
create policy moloko_settings_write on public.moloko_settings for all to authenticated
  using (public.moloko_is_owner()) with check (public.moloko_is_owner());

drop policy if exists moloko_bookings_staff on public.moloko_bookings;
create policy moloko_bookings_staff on public.moloko_bookings for all to authenticated
  using (public.moloko_is_staff()) with check (public.moloko_is_staff());

revoke all on public.moloko_staff, public.moloko_settings, public.moloko_bookings from anon;
grant select on public.moloko_settings to anon;
grant select, insert, update, delete on public.moloko_bookings, public.moloko_settings to authenticated;
grant select on public.moloko_staff to authenticated;

-- ------------------------------------------------------------------ default prices
insert into public.moloko_settings (id, data) values (1, '{
  "halls": {"white": 15000, "beige": 20000, "grey": 20000, "black": 20000},
  "night": 2000, "guest": 1000, "freeGuests": 6, "confetti": 5000,
  "equip": {"light":1500,"smoke":2000,"snow":10000,"proj":2000,"laser":2000,"gobo_j":1000,"gobo_a":2000,"jedi":1000,"rgb":1000,"tripod":1000},
  "loyalty": {"milk":3,"cream":5,"gold":8,"creamAt":20,"goldAt":60}
}'::jsonb) on conflict (id) do nothing;

-- ------------------------------------------------------------------ public RPCs (booking widget)
-- Is the studio still waiting for its first owner account?
create or replace function public.moloko_needs_setup() returns boolean
language sql stable security definer set search_path = public as $$
  select not exists (select 1 from public.moloko_staff);
$$;

-- Busy hours only: no names or phones leave the database for anonymous visitors.
create or replace function public.moloko_busy(p_from date, p_to date)
returns table (hall text, date date, start_hour smallint, hours smallint)
language sql stable security definer set search_path = public as $$
  select b.hall, b.date, b.start_hour, b.hours
  from public.moloko_bookings b
  where b.status <> 'cancelled'
    and b.date between p_from - 1 and p_to
    and p_to - p_from <= 62;
$$;

-- Price on the server, so a client cannot change its own total.
create or replace function public.moloko_quote(p_hall text, p_start int, p_hours int, p_guests int, p_equip text[], p_confetti boolean)
returns integer language plpgsql stable security definer set search_path = public as $$
declare
  s jsonb; total int; nights int := 0; k int; h int; e text;
begin
  select data into s from public.moloko_settings where id = 1;
  total := coalesce((s->'halls'->>p_hall)::int, 0) * p_hours;
  for k in 0 .. p_hours - 1 loop
    h := (p_start + k) % 24;
    if h >= 21 or h < 9 then nights := nights + 1; end if;
  end loop;
  total := total + nights * coalesce((s->>'night')::int, 0);
  total := total + greatest(0, p_guests - coalesce((s->>'freeGuests')::int, 6)) * p_hours * coalesce((s->>'guest')::int, 0);
  foreach e in array coalesce(p_equip, '{}') loop
    total := total + coalesce((s->'equip'->>e)::int, 0) * p_hours;
  end loop;
  if p_confetti then total := total + coalesce((s->>'confetti')::int, 0); end if;
  return total;
end $$;

-- Client request from the widget. Always lands as status 'new'; the admin then sends a Kaspi invoice.
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
  v_local timestamp := now() at time zone 'Asia/Almaty';
  v_total int; v_id uuid;
begin
  if v_hall not in ('white','beige','grey','black') then raise exception 'bad_hall'; end if;
  if v_start not between 0 and 23 or v_hours not between 1 and 12 then raise exception 'bad_time'; end if;
  if v_date + make_interval(hours => v_start) <= v_local then raise exception 'past'; end if;
  if v_date > v_local::date + 90 then raise exception 'too_far'; end if;
  if v_guests not between 1 and 40 then raise exception 'bad_guests'; end if;
  if char_length(v_name) not between 2 and 80 then raise exception 'bad_name'; end if;
  if char_length(regexp_replace(v_phone, '\D', '', 'g')) not between 10 and 15 then raise exception 'bad_phone'; end if;
  if v_confetti and v_hall = 'grey' then raise exception 'no_confetti_in_grey'; end if;
  if exists (select 1 from unnest(v_equip) e where e not in ('light','smoke','snow','proj','laser','gobo_j','gobo_a','jedi','rgb','tripod')) then
    raise exception 'bad_equip';
  end if;
  -- simple flood guard: at most 3 open requests per phone
  if (select count(*) from public.moloko_bookings
      where regexp_replace(phone, '\D', '', 'g') = regexp_replace(v_phone, '\D', '', 'g')
        and status = 'new' and created_at > now() - interval '1 day') >= 3 then
    raise exception 'too_many';
  end if;

  v_total := public.moloko_quote(v_hall, v_start, v_hours, v_guests, v_equip, v_confetti);

  begin
    insert into public.moloko_bookings (hall, date, start_hour, hours, status, name, phone, total, source, extra)
    values (v_hall, v_date, v_start, v_hours, 'new', v_name, v_phone, v_total, 'Виджет',
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
  return jsonb_build_object('id', v_id, 'total', v_total);
end $$;

revoke all on function public.moloko_needs_setup(), public.moloko_busy(date, date),
  public.moloko_quote(text, int, int, int, text[], boolean), public.moloko_book(jsonb),
  public.moloko_is_staff(), public.moloko_is_owner() from public, anon;
grant execute on function public.moloko_needs_setup(), public.moloko_busy(date, date),
  public.moloko_quote(text, int, int, int, text[], boolean), public.moloko_book(jsonb) to anon, authenticated;
grant execute on function public.moloko_is_staff(), public.moloko_is_owner() to authenticated;

-- ------------------------------------------------------------------ realtime for the CRM
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin alter publication supabase_realtime add table public.moloko_bookings; exception when duplicate_object then null; end;
    begin alter publication supabase_realtime add table public.moloko_staff;    exception when duplicate_object then null; end;
    begin alter publication supabase_realtime add table public.moloko_settings; exception when duplicate_object then null; end;
  end if;
end $$;
