import { NextResponse } from "next/server";
import { z } from "zod";
import { getAppStore } from "@/lib/db/hydrate";
import { updateProductSellingPriceInDb } from "@/lib/db/writes";

const bodySchema = z.object({
  selling_price: z.number().nonnegative().nullable(),
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
      store.updateSellingPrice(productId, parsed.data.selling_price);
    } else {
      await updateProductSellingPriceInDb(productId, parsed.data.selling_price);
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Server error" },
      { status: 503 },
    );
  }
}
