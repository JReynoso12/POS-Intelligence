import { NextResponse } from "next/server";
import { z } from "zod";
import { getAppStore } from "@/lib/db/hydrate";
import { listSaleOrdersFromDb, recordSaleInDb } from "@/lib/db/writes";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const limit = Math.min(100, Number(url.searchParams.get("limit")) || 50);

  try {
    if (process.env.USE_DEMO_DATA === "1") {
      const store = await getAppStore();
      return NextResponse.json({ orders: store.listSaleOrders(limit) });
    }
    const orders = await listSaleOrdersFromDb(limit);
    return NextResponse.json({ orders });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Server error" },
      { status: 503 },
    );
  }
}

const bodySchema = z.object({
  items: z
    .array(
      z.object({
        product_id: z.string(),
        quantity: z.number().positive(),
        unit_price: z.number().nonnegative(),
      }),
    )
    .min(1),
});

export async function POST(req: Request) {
  const json = await req.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  try {
    if (process.env.USE_DEMO_DATA === "1") {
      const store = await getAppStore();
      const sale = store.recordSale(parsed.data.items);
      return NextResponse.json({ sale });
    }
    const sale = await recordSaleInDb(parsed.data.items);
    return NextResponse.json({ sale });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Server error" },
      { status: 503 },
    );
  }
}
