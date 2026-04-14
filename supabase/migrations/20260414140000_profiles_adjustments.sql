-- App role per auth user (owner vs cashier kiosk)
create table if not exists public.app_profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role text not null default 'owner' check (role in ('owner', 'cashier')),
  updated_at timestamptz not null default now()
);

comment on table public.app_profiles is 'Maps Supabase auth users to app role for POS Intelligence UI.';

-- Optional audit trail for manual stock adjustments
create table if not exists public.inventory_adjustments (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  quantity_delta numeric(12, 2) not null,
  reason text,
  created_at timestamptz not null default now()
);

create index if not exists inventory_adjustments_product_created
  on public.inventory_adjustments (product_id, created_at desc);
