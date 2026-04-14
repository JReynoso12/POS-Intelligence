import { NextResponse } from "next/server";
import Papa from "papaparse";
import { z } from "zod";
import { getAppStore } from "@/lib/db/hydrate";
import { importSaleRowsToDb } from "@/lib/db/writes";

const rowSchema = z.object({
  date: z.string(),
  sku: z.string().optional(),
  product_name: z.string().optional(),
  quantity: z.coerce.number().positive(),
  unit_price: z.coerce.number().nonnegative(),
});

export async function POST(req: Request) {
  const text = await req.text();
  if (!text.trim()) {
    return NextResponse.json({ error: "Empty body" }, { status: 400 });
  }
  const parsed = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
  });
  if (parsed.errors.length) {
    return NextResponse.json(
      { error: "CSV parse error", details: parsed.errors },
      { status: 400 },
    );
  }
  const rows: z.infer<typeof rowSchema>[] = [];
  for (const r of parsed.data) {
    const norm = {
      date: r.date ?? r.Date ?? r.sold_at ?? "",
      sku: r.sku ?? r.SKU ?? "",
      product_name: r.product_name ?? r.product ?? r.name ?? "",
      quantity: r.quantity ?? r.qty ?? "",
      unit_price: r.unit_price ?? r.price ?? "",
    };
    const row = rowSchema.safeParse({
      date: norm.date,
      sku: norm.sku || undefined,
      product_name: norm.product_name || undefined,
      quantity: norm.quantity,
      unit_price: norm.unit_price,
    });
    if (row.success) rows.push(row.data);
  }

  try {
    if (process.env.USE_DEMO_DATA === "1") {
      const store = await getAppStore();
      const result = store.importSaleRows(rows);
      return NextResponse.json(result);
    }
    const result = await importSaleRowsToDb(rows);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Server error" },
      { status: 503 },
    );
  }
}
