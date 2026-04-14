import { NextResponse } from "next/server";
import { z } from "zod";
import { getAppStore } from "@/lib/db/hydrate";
import { adjustInventoryInDb } from "@/lib/db/writes";

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

  try {
    if (process.env.USE_DEMO_DATA === "1") {
      const store = await getAppStore();
      if (parsed.data.adjust != null) {
        store.adjustStock(productId, parsed.data.adjust);
      }
      if (parsed.data.low_stock_threshold != null) {
        store.setThreshold(productId, parsed.data.low_stock_threshold);
      }
    } else {
      await adjustInventoryInDb(
        productId,
        parsed.data.adjust,
        parsed.data.low_stock_threshold,
      );
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Server error" },
      { status: 503 },
    );
  }
}
