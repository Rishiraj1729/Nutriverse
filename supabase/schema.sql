-- Customer accounts + order history + admin order board
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  phone text,
  created_at timestamptz not null default now()
);

create table if not exists public.orders (
  id text primary key,
  user_id uuid references auth.users (id) on delete set null,
  status text not null default 'pending',
  payment text not null,
  subtotal integer not null,
  shipping integer not null,
  total integer not null,
  customer jsonb not null,
  items jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists orders_user_id_created_at_idx
  on public.orders (user_id, created_at desc);

create index if not exists orders_created_at_idx
  on public.orders (created_at desc);

alter table public.profiles enable row level security;
alter table public.orders enable row level security;

drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles
  for select to authenticated
  using (id = auth.uid());

drop policy if exists profiles_upsert_own on public.profiles;
create policy profiles_insert_own on public.profiles
  for insert to authenticated
  with check (id = auth.uid());

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

drop policy if exists orders_select_own on public.orders;
create policy orders_select_own on public.orders
  for select to authenticated
  using (user_id = auth.uid());

drop policy if exists orders_insert_own on public.orders;
create policy orders_insert_own on public.orders
  for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists orders_select_admin on public.orders;
create policy orders_select_admin on public.orders
  for select to authenticated
  using (lower(coalesce(auth.jwt() ->> 'email', '')) = 'contact@thenutriverse.in');

drop policy if exists orders_update_admin on public.orders;
create policy orders_update_admin on public.orders
  for update to authenticated
  using (lower(coalesce(auth.jwt() ->> 'email', '')) = 'contact@thenutriverse.in')
  with check (lower(coalesce(auth.jwt() ->> 'email', '')) = 'contact@thenutriverse.in');

grant select, insert, update on public.profiles to authenticated;
grant select, insert, update on public.orders to authenticated;
