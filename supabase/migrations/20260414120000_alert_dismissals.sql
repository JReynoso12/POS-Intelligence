-- Persist “dismissed” auto alerts so resolve survives reloads when using Supabase
create table if not exists public.alert_dismissals (
  product_id uuid not null references public.products (id) on delete cascade,
  alert_type text not null,
  created_at timestamptz not null default now(),
  primary key (product_id, alert_type)
);
