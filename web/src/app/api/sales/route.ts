import { NextResponse } from "next/server";
import { z } from "zod";
import { getMemoryStore } from "@/lib/memory-store";

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
  const store = getMemoryStore();
  const sale = store.recordSale(parsed.data.items);
  return NextResponse.json({ sale });
}
