-- Demo seed (runs on `supabase db reset` locally only — not via `db push` on remote)
-- Idempotent: skips rows that already exist for the same SKU.

insert into public.products (name, sku, category, cost_price, selling_price)
select v.name, v.sku, v.category, v.cost_price, v.selling_price
from (
  values
    ('Milk 1L', 'MLK-1L', 'Dairy', 0.80, 1.40),
    ('Chicken Breast 1kg', 'CHK-BR', 'Meat', 4.50, 8.99),
    ('Rice 25kg', 'RICE-25', 'Staples', 18.00, 32.50),
    ('Eggs 12pc', 'EGG-12', 'Dairy', 1.20, 2.50),
    ('Cooking Oil 2L', 'OIL-2L', 'Staples', 3.10, 5.49),
    ('Sparkling Water 500ml', 'H2O-05', 'Beverages', 0.35, 0.99)
) as v(name, sku, category, cost_price, selling_price)
where not exists (
  select 1 from public.products p where lower(p.sku) = lower(v.sku)
);

insert into public.inventory (product_id, quantity, low_stock_threshold)
select p.id, v.qty, v.low_at
from public.products p
join (
  values
    ('MLK-1L', 4::numeric, 5::numeric),
    ('CHK-BR', 0::numeric, 3::numeric),
    ('RICE-25', 40::numeric, 8::numeric),
    ('EGG-12', 24::numeric, 10::numeric),
    ('OIL-2L', 14::numeric, 6::numeric),
    ('H2O-05', 120::numeric, 20::numeric)
) as v(sku, qty, low_at) on lower(p.sku) = lower(v.sku)
on conflict (product_id) do update
set
  quantity = excluded.quantity,
  low_stock_threshold = excluded.low_stock_threshold,
  updated_at = now();
