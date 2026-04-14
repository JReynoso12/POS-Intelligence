import { NextResponse } from "next/server";
import { getMemoryStore } from "@/lib/memory-store";

export async function GET() {
  const store = getMemoryStore();
  const rows = store.getInventory();
  return NextResponse.json({
    items: rows.map((r) => ({
      product_id: r.product_id,
      quantity: r.quantity,
      low_stock_threshold: r.low_stock_threshold,
      updated_at: r.updated_at,
      product: r.product,
      status: store.statusFor(r),
    })),
  });
}
