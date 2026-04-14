import { NextResponse } from "next/server";
import { z } from "zod";
import { getMemoryStore } from "@/lib/memory-store";

const bodySchema = z.object({
  adjust: z.number().optional(),
  low_stock_threshold: z.number().nonnegative().optional(),
});

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ productId: string }> },
) {
  const { productId } = await ctx.params;
  const json = await req.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const store = getMemoryStore();
  if (parsed.data.adjust != null) {
    store.adjustStock(productId, parsed.data.adjust);
  }
  if (parsed.data.low_stock_threshold != null) {
    store.setThreshold(productId, parsed.data.low_stock_threshold);
  }
  return NextResponse.json({ ok: true });
}
