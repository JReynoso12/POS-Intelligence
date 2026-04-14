-- POS Intelligence — core schema for Supabase (Postgres)
-- Applied via: supabase db push (remote) or supabase db reset (local)

create extension if not exists "pgcrypto";

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sku text,
  category text,
  cost_price numeric(12, 2),
  selling_price numeric(12, 2),
  created_at timestamptz not null default now()
);

create unique index if not exists products_sku_key on public.products (lower(sku)) where sku is not null;

create table if not exists public.inventory (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  quantity numeric(12, 2) not null default 0 check (quantity >= 0),
  low_stock_threshold numeric(12, 2) not null default 5 check (low_stock_threshold >= 0),
  updated_at timestamptz not null default now(),
  unique (product_id)
);

create table if not exists public.sales (
  id uuid primary key default gen_random_uuid(),
  total numeric(12, 2) not null,
  created_at timestamptz not null default now()
);

create table if not exists public.sale_items (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.sales (id) on delete cascade,
  product_id uuid not null references public.products (id),
  quantity numeric(12, 2) not null check (quantity > 0),
  unit_price numeric(12, 2) not null
);

create index if not exists sale_items_product_created on public.sale_items (product_id);

create table if not exists public.alerts (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  alert_type text not null check (
    alert_type in ('low_stock', 'stockout', 'fast_moving', 'slow_moving')
  ),
  message text not null,
  meta jsonb,
  resolved boolean not null default false,
  source text not null default 'auto' check (source in ('auto', 'manual')),
  created_at timestamptz not null default now()
);

create index if not exists alerts_unresolved on public.alerts (resolved, created_at desc);

-- Optional: users for Row Level Security later
create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  role text not null default 'owner',
  created_at timestamptz not null default now()
);
