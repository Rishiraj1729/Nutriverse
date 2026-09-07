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

create or replace function public.is_store_admin()
returns boolean
language sql
stable
as $$
  select
    coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin'
    or lower(coalesce(auth.jwt() ->> 'email', '')) in (
      'contact@thenutriverse.in',
      'admin_nutriverse@thenutriverse.in'
    );
$$;

grant execute on function public.is_store_admin() to authenticated;

drop policy if exists orders_select_admin on public.orders;
create policy orders_select_admin on public.orders
  for select to authenticated
  using (public.is_store_admin());

drop policy if exists orders_update_admin on public.orders;
create policy orders_update_admin on public.orders
  for update to authenticated
  using (public.is_store_admin())
  with check (public.is_store_admin());

grant select, insert, update on public.profiles to authenticated;
grant select, insert, update on public.orders to authenticated;

create table if not exists public.products (
  id text primary key,
  name text not null,
  category text not null default 'makhana',
  price integer not null check (price > 0 and price < 100000),
  unit text not null default 'pack',
  image text not null default 'assets/product.png',
  blurb text not null default '',
  active boolean not null default true,
  sort_order integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists products_active_sort_idx
  on public.products (active, sort_order, name);

create table if not exists public.store_settings (
  id smallint primary key default 1 check (id = 1),
  shipping_flat integer not null default 49 check (shipping_flat >= 0 and shipping_flat < 10000),
  free_above integer not null default 499 check (free_above >= 0 and free_above < 100000),
  updated_at timestamptz not null default now()
);

alter table public.products enable row level security;
alter table public.store_settings enable row level security;

drop policy if exists products_public_read on public.products;
create policy products_public_read on public.products
  for select to anon, authenticated
  using (active = true);

drop policy if exists products_admin_all on public.products;
create policy products_admin_all on public.products
  for all to authenticated
  using (public.is_store_admin())
  with check (public.is_store_admin());

drop policy if exists settings_public_read on public.store_settings;
create policy settings_public_read on public.store_settings
  for select to anon, authenticated
  using (true);

drop policy if exists settings_admin_update on public.store_settings;
create policy settings_admin_update on public.store_settings
  for update to authenticated
  using (public.is_store_admin())
  with check (public.is_store_admin());

grant select on public.products to anon, authenticated;
grant insert, update, delete on public.products to authenticated;
grant select on public.store_settings to anon, authenticated;
grant update on public.store_settings to authenticated;
