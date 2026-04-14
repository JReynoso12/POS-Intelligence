import { NextResponse } from "next/server";
import { getAppStore } from "@/lib/db/hydrate";

export async function GET() {
  try {
    const store = await getAppStore();
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
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Server error" },
      { status: 503 },
    );
  }
}
