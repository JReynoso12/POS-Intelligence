import { createServiceClient } from "@/lib/supabase/admin";
import type { Product } from "@/lib/types";

function num(v: unknown): number {
  if (v == null || v === "") return 0;
  if (typeof v === "number") return v;
  const x = parseFloat(String(v));
  return Number.isFinite(x) ? x : 0;
}

export type SaleLine = {
  product_id: string;
  quantity: number;
  unit_price: number;
};

function mapProductRow(row: Record<string, unknown>): Product {
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

export async function recordSaleInDb(items: SaleLine[], createdAt?: Date) {
  const sb = createServiceClient();
  let total = 0;
  for (const it of items) {
    total += it.quantity * it.unit_price;
  }
  total = Math.round(total * 100) / 100;

  const needByProduct = new Map<string, number>();
  for (const it of items) {
    needByProduct.set(
      it.product_id,
      (needByProduct.get(it.product_id) ?? 0) + it.quantity,
    );
  }
  for (const [productId, need] of needByProduct) {
    const { data: invRow, error: ev } = await sb
      .from("inventory")
      .select("quantity")
      .eq("product_id", productId)
      .maybeSingle();
    if (ev) throw ev;
    if (!invRow) {
      throw new Error(`No inventory row for product ${productId}`);
    }
    if (num(invRow.quantity) < need) {
      throw new Error("Insufficient stock for one or more lines");
    }
  }

  const insertPayload: { total: number; created_at?: string } = { total };
  if (createdAt) {
    insertPayload.created_at = createdAt.toISOString();
  }

  const { data: sale, error: e1 } = await sb
    .from("sales")
    .insert(insertPayload)
    .select("id, total, created_at")
    .single();
  if (e1) throw e1;

  for (const it of items) {
    const { error: e2 } = await sb.from("sale_items").insert({
      sale_id: sale.id,
      product_id: it.product_id,
      quantity: it.quantity,
      unit_price: it.unit_price,
    });
    if (e2) {
      await sb.from("sales").delete().eq("id", sale.id);
      throw e2;
    }

    const { data: invRow, error: e3 } = await sb
      .from("inventory")
      .select("quantity")
      .eq("product_id", it.product_id)
      .maybeSingle();
    if (e3) {
      await sb.from("sales").delete().eq("id", sale.id);
      throw e3;
    }
    if (!invRow) {
      await sb.from("sales").delete().eq("id", sale.id);
      throw new Error(`No inventory row for product ${it.product_id}`);
    }
    const cur = num(invRow.quantity);
    const newQty = Math.max(0, cur - it.quantity);
    const { error: e4 } = await sb
      .from("inventory")
      .update({
        quantity: newQty,
        updated_at: new Date().toISOString(),
      })
      .eq("product_id", it.product_id);
    if (e4) {
      await sb.from("sales").delete().eq("id", sale.id);
      throw e4;
    }
  }

  return {
    id: String(sale.id),
    total: num(sale.total),
    created_at: String(sale.created_at),
  };
}

export async function updateProductSellingPriceInDb(
  productId: string,
  selling_price: number | null,
) {
  const sb = createServiceClient();
  const { error } = await sb
    .from("products")
    .update({ selling_price })
    .eq("id", productId);
  if (error) throw error;
}

export async function adjustInventoryInDb(
  productId: string,
  adjust?: number,
  low_stock_threshold?: number,
) {
  const sb = createServiceClient();
  if (adjust != null) {
    const { data: invRow, error: e1 } = await sb
      .from("inventory")
      .select("quantity")
      .eq("product_id", productId)
      .maybeSingle();
    if (e1) throw e1;
    const cur = num(invRow?.quantity);
    const newQty = Math.max(0, cur + adjust);
    const { error: e2 } = await sb
      .from("inventory")
      .update({
        quantity: newQty,
        updated_at: new Date().toISOString(),
      })
      .eq("product_id", productId);
    if (e2) throw e2;
  }
  if (low_stock_threshold != null) {
    const { error: e3 } = await sb
      .from("inventory")
      .update({
        low_stock_threshold: Math.max(0, low_stock_threshold),
        updated_at: new Date().toISOString(),
      })
      .eq("product_id", productId);
    if (e3) throw e3;
  }
}

/** Persist user dismiss for auto-generated alerts (id format `type::uuid`). */
export async function persistAlertDismissal(alertId: string) {
  const idx = alertId.indexOf("::");
  if (idx < 0) return;
  const alert_type = alertId.slice(0, idx);
  const product_id = alertId.slice(idx + 2);
  const sb = createServiceClient();
  const { error } = await sb.from("alert_dismissals").upsert(
    { product_id, alert_type },
    { onConflict: "product_id,alert_type" },
  );
  if (error) throw error;
}

/** Resolve auto (stable id) or manual (uuid) alert in the database. */
export async function resolveAlertInDb(alertId: string) {
  if (alertId.includes("::")) {
    await persistAlertDismissal(alertId);
    return;
  }
  const sb = createServiceClient();
  const { error } = await sb
    .from("alerts")
    .update({ resolved: true })
    .eq("id", alertId);
  if (error) throw error;
}

export async function importSaleRowsToDb(
  csvRows: {
    date: string;
    sku?: string;
    product_name?: string;
    quantity: number;
    unit_price: number;
  }[],
): Promise<{ imported: number; errors: string[] }> {
  const sb = createServiceClient();
  const { data: rowsP, error } = await sb.from("products").select("*");
  if (error) throw error;
  const products = (rowsP ?? []).map((r) =>
    mapProductRow(r as Record<string, unknown>),
  );

  const errors: string[] = [];
  let imported = 0;
  for (const row of csvRows) {
    const t = new Date(row.date);
    if (Number.isNaN(t.getTime())) {
      errors.push(`Bad date: ${row.date}`);
      continue;
    }
    let product: Product | undefined;
    if (row.sku) {
      product = products.find(
        (p) => p.sku?.toLowerCase() === row.sku!.toLowerCase(),
      );
    }
    if (!product && row.product_name) {
      product = products.find(
        (p) => p.name.toLowerCase() === row.product_name!.toLowerCase(),
      );
    }
    if (!product) {
      errors.push(`Unknown product: ${row.sku ?? row.product_name ?? "?"}`);
      continue;
    }
    try {
      await recordSaleInDb(
        [
          {
            product_id: product.id,
            quantity: row.quantity,
            unit_price: row.unit_price,
          },
        ],
        t,
      );
      imported += 1;
    } catch (e) {
      errors.push(
        e instanceof Error ? e.message : "Failed to record sale",
      );
    }
  }
  return { imported, errors };
}
