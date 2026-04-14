import { NextResponse } from "next/server";
import { z } from "zod";
import { getAppStore } from "@/lib/db/hydrate";
import { insertProductInDb } from "@/lib/db/writes";

const postSchema = z.object({
  name: z.string().min(1),
  sku: z.string().nullable().optional(),
  category: z.string().nullable().optional(),
  cost_price: z.number().nonnegative().nullable().optional(),
  selling_price: z.number().nonnegative().nullable().optional(),
  initial_stock: z.number().nonnegative(),
  low_stock_threshold: z.number().nonnegative(),
});

export async function GET() {
  try {
    const store = await getAppStore();
    return NextResponse.json({ products: store.products });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Server error" },
      { status: 503 },
    );
  }
}

export async function POST(req: Request) {
  const json = await req.json().catch(() => ({}));
  const parsed = postSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  try {
    if (process.env.USE_DEMO_DATA === "1") {
      const store = await getAppStore();
      const product = store.addProduct({
        name: parsed.data.name,
        sku: parsed.data.sku ?? null,
        category: parsed.data.category ?? null,
        cost_price: parsed.data.cost_price ?? null,
        selling_price: parsed.data.selling_price ?? null,
        initial_stock: parsed.data.initial_stock,
        low_stock_threshold: parsed.data.low_stock_threshold,
      });
      return NextResponse.json({ product });
    }
    const product = await insertProductInDb({
      name: parsed.data.name,
      sku: parsed.data.sku ?? null,
      category: parsed.data.category ?? null,
      cost_price: parsed.data.cost_price ?? null,
      selling_price: parsed.data.selling_price ?? null,
      initial_stock: parsed.data.initial_stock,
      low_stock_threshold: parsed.data.low_stock_threshold,
    });
    return NextResponse.json({ product });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Server error" },
      { status: 503 },
    );
  }
}
