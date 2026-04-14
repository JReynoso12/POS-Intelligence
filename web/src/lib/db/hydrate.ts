import {
  createServiceClient,
  isSupabaseConfigured,
} from "@/lib/supabase/admin";
import { getDemoMemoryStore, MemoryStore } from "@/lib/memory-store";
import type {
  AlertRecord,
  AlertType,
  InventoryRow,
  Product,
  Sale,
  SaleItem,
} from "@/lib/types";

const SALES_LOOKBACK_DAYS = 400;

function num(v: unknown): number {
  if (v == null || v === "") return 0;
  if (typeof v === "number") return v;
  const x = parseFloat(String(v));
  return Number.isFinite(x) ? x : 0;
}

function mapProduct(row: Record<string, unknown>): Product {
  return {
    id: String(row.id),
    name: String(row.name),
    sku: row.sku != null ? String(row.sku) : null,
    category: row.category != null ? String(row.category) : null,
    cost_price: row.cost_price != null ? num(row.cost_price) : null,
    selling_price: row.selling_price != null ? num(row.selling_price) : null,
    created_at: String(row.created_at ?? new Date().toISOString()),
  };
}

function mapInventory(row: Record<string, unknown>): InventoryRow {
  return {
    product_id: String(row.product_id),
    quantity: num(row.quantity),
    low_stock_threshold: num(row.low_stock_threshold),
    updated_at: String(row.updated_at ?? new Date().toISOString()),
  };
}

function mapSale(row: Record<string, unknown>): Sale {
  return {
    id: String(row.id),
    total: num(row.total),
    created_at: String(row.created_at ?? new Date().toISOString()),
  };
}

function mapSaleItem(row: Record<string, unknown>): SaleItem {
  return {
    id: String(row.id),
    sale_id: String(row.sale_id),
    product_id: String(row.product_id),
    quantity: num(row.quantity),
    unit_price: num(row.unit_price),
  };
}

async function cleanupStaleDismissals(
  store: MemoryStore,
  sb: ReturnType<typeof createServiceClient>,
) {
  const { data: rows, error } = await sb.from("alert_dismissals").select("*");
  if (error || !rows?.length) return;
  for (const row of rows) {
    const inv = store.inventory.find((i) => i.product_id === row.product_id);
    if (!inv) continue;
    const t = String(row.alert_type);
    const shouldRemove =
      (t === "low_stock" && inv.quantity >= inv.low_stock_threshold) ||
      (t === "stockout" && inv.quantity > 0);
    if (shouldRemove) {
      await sb
        .from("alert_dismissals")
        .delete()
        .eq("product_id", row.product_id)
        .eq("alert_type", row.alert_type);
    }
  }
}

async function loadDismissalKeys(
  sb: ReturnType<typeof createServiceClient>,
): Promise<Set<string>> {
  const { data, error } = await sb.from("alert_dismissals").select("*");
  if (error || !data) return new Set();
  return new Set(
    data.map((r) => `${String(r.alert_type)}:${String(r.product_id)}`),
  );
}

async function loadManualAlerts(
  sb: ReturnType<typeof createServiceClient>,
): Promise<AlertRecord[]> {
  try {
    const { data, error } = await sb
      .from("alerts")
      .select("*")
      .eq("source", "manual")
      .eq("resolved", false);
    if (error || !data?.length) return [];
    return data.map((row) => ({
      id: String(row.id),
      product_id: String(row.product_id),
      alert_type: row.alert_type as AlertType,
      message: String(row.message),
      meta: (row.meta as Record<string, unknown>) ?? null,
      resolved: Boolean(row.resolved),
      source: "manual" as const,
      created_at: String(row.created_at ?? new Date().toISOString()),
    }));
  } catch {
    return [];
  }
}

/** Load sales + items from Postgres into a fresh MemoryStore (no demo seed). */
export async function hydrateStoreFromSupabase(): Promise<MemoryStore> {
  const sb = createServiceClient();
  const since = new Date();
  since.setDate(since.getDate() - SALES_LOOKBACK_DAYS);

  const [{ data: products, error: e1 }, { data: inventory, error: e2 }] =
    await Promise.all([
      sb.from("products").select("*").order("name"),
      sb.from("inventory").select("*"),
    ]);
  if (e1) throw e1;
  if (e2) throw e2;

  const { data: sales, error: e3 } = await sb
    .from("sales")
    .select("id, total, created_at")
    .gte("created_at", since.toISOString())
    .order("created_at", { ascending: true });
  if (e3) throw e3;

  const saleList = (sales ?? []).map(mapSale);
  const saleIds = saleList.map((s) => s.id);
  let saleItems: SaleItem[] = [];
  if (saleIds.length > 0) {
    const chunk = 200;
    for (let i = 0; i < saleIds.length; i += chunk) {
      const part = saleIds.slice(i, i + chunk);
      const { data: items, error: e4 } = await sb
        .from("sale_items")
        .select("*")
        .in("sale_id", part);
      if (e4) throw e4;
      saleItems = saleItems.concat((items ?? []).map(mapSaleItem));
    }
  }

  const store = new MemoryStore();
  store.products = (products ?? []).map(mapProduct);
  store.inventory = (inventory ?? []).map(mapInventory);
  store.sales = saleList;
  store.saleItems = saleItems;

  try {
    await cleanupStaleDismissals(store, sb);
    store.dismissalKeys = await loadDismissalKeys(sb);
  } catch {
    store.dismissalKeys = new Set();
  }

  const manual = await loadManualAlerts(sb);
  store.alerts = manual;

  store.refreshAlerts();
  return store;
}

/**
 * Primary data access for API routes: Supabase when configured, otherwise optional demo store.
 */
export async function getAppStore(): Promise<MemoryStore> {
  if (process.env.USE_DEMO_DATA === "1") {
    return getDemoMemoryStore();
  }
  if (!isSupabaseConfigured()) {
    throw new Error(
      "Database not configured: set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or USE_DEMO_DATA=1 for local demo).",
    );
  }
  return hydrateStoreFromSupabase();
}
