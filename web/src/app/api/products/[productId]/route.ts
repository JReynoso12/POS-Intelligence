import { NextResponse } from "next/server";
import { z } from "zod";
import { getAppStore } from "@/lib/db/hydrate";
import {
  deleteProductInDb,
  updateProductFieldsInDb,
  updateProductSellingPriceInDb,
} from "@/lib/db/writes";

const patchSchema = z
  .object({
    selling_price: z.number().nonnegative().nullable().optional(),
    category: z.string().nullable().optional(),
    name: z.string().min(1).optional(),
    cost_price: z.number().nonnegative().nullable().optional(),
    sku: z.string().nullable().optional(),
  })
  .refine((d) => Object.keys(d).length > 0, { message: "Empty patch" });

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ productId: string }> },
) {
  const { productId } = await ctx.params;
  const json = await req.json().catch(() => ({}));
  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const data = parsed.data;
  const onlyPrice =
    data.selling_price !== undefined &&
    data.category === undefined &&
    data.name === undefined &&
    data.cost_price === undefined &&
    data.sku === undefined;

  try {
    if (process.env.USE_DEMO_DATA === "1") {
      const store = await getAppStore();
      if (onlyPrice) {
        store.updateSellingPrice(productId, data.selling_price ?? null);
      } else {
        store.updateProductFields(productId, {
          selling_price: data.selling_price,
          category: data.category,
          name: data.name,
          cost_price: data.cost_price,
          sku: data.sku,
        });
      }
    } else if (onlyPrice) {
      await updateProductSellingPriceInDb(productId, data.selling_price ?? null);
    } else {
      const patch: Parameters<typeof updateProductFieldsInDb>[1] = {};
      if (data.selling_price !== undefined) patch.selling_price = data.selling_price;
      if (data.category !== undefined) patch.category = data.category;
      if (data.name !== undefined) patch.name = data.name;
      if (data.cost_price !== undefined) patch.cost_price = data.cost_price;
      if (data.sku !== undefined) patch.sku = data.sku;
      await updateProductFieldsInDb(productId, patch);
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Server error" },
      { status: 503 },
    );
  }
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ productId: string }> },
) {
  const { productId } = await ctx.params;
  try {
    if (process.env.USE_DEMO_DATA === "1") {
      const store = await getAppStore();
      const result = store.deleteProduct(productId);
      if (!result.ok) {
        return NextResponse.json(
          { error: result.error ?? "Delete failed" },
          { status: 400 },
        );
      }
      return NextResponse.json({ ok: true });
    }
    await deleteProductInDb(productId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Server error" },
      { status: e instanceof Error && e.message.includes("sales") ? 400 : 503 },
    );
  }
}
