"use client";

import { useEffect, useState } from "react";
import { RecordSale } from "@/components/record-sale";
import { money } from "@/lib/format";

type Row = {
  product_id: string;
  quantity: number;
  low_stock_threshold: number;
  updated_at: string;
  product: {
    id: string;
    name: string;
    sku: string | null;
    selling_price: number | null;
  };
  status: "ok" | "low" | "out";
};

export default function InventoryPage() {
  const [items, setItems] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const r = await fetch("/api/inventory");
    const j = await r.json();
    setItems(j.items ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function patch(
    productId: string,
    body: { adjust?: number; low_stock_threshold?: number },
  ) {
    await fetch(`/api/inventory/${productId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    await load();
  }

  return (
    <div className="space-y-6">
      <RecordSale onRecorded={load} />
      <div>
        <h2 className="text-xl font-semibold text-white">Inventory</h2>
        <p className="text-sm text-zinc-500">
          Stock levels update when you record sales. Adjust counts after
          deliveries or shrink.
        </p>
      </div>

      {loading ? (
        <p className="text-zinc-500">Loading…</p>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-white/10">
          <table className="w-full text-left text-sm">
            <thead className="bg-white/5 text-xs uppercase tracking-wide text-zinc-400">
              <tr>
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3">SKU</th>
                <th className="px-4 py-3">On hand</th>
                <th className="px-4 py-3">Low at</th>
                <th className="px-4 py-3">Price</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Adjust</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {items.map((row) => (
                <tr key={row.product_id} className="bg-black/10">
                  <td className="px-4 py-3 font-medium text-zinc-100">
                    {row.product.name}
                  </td>
                  <td className="px-4 py-3 text-zinc-500">
                    {row.product.sku ?? "—"}
                  </td>
                  <td className="px-4 py-3">{row.quantity}</td>
                  <td className="px-4 py-3">
                    <input
                      type="number"
                      min={0}
                      defaultValue={row.low_stock_threshold}
                      className="w-20 rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-zinc-100"
                      onBlur={(e) => {
                        const v = Number(e.target.value);
                        if (!Number.isNaN(v))
                          patch(row.product_id, { low_stock_threshold: v });
                      }}
                    />
                  </td>
                  <td className="px-4 py-3 text-zinc-400">
                    {row.product.selling_price != null
                      ? money(row.product.selling_price)
                      : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={row.status} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button
                        type="button"
                        className="rounded-lg bg-white/10 px-2 py-1 text-xs hover:bg-white/15"
                        onClick={() => patch(row.product_id, { adjust: -1 })}
                      >
                        −1
                      </button>
                      <button
                        type="button"
                        className="rounded-lg bg-emerald-500/20 px-2 py-1 text-xs text-emerald-200 hover:bg-emerald-500/30"
                        onClick={() => patch(row.product_id, { adjust: 10 })}
                      >
                        +10
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: Row["status"] }) {
  if (status === "out") {
    return (
      <span className="rounded-full bg-rose-500/15 px-2 py-0.5 text-xs font-medium text-rose-300 ring-1 ring-rose-500/30">
        Out
      </span>
    );
  }
  if (status === "low") {
    return (
      <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-200 ring-1 ring-amber-500/30">
        Low
      </span>
    );
  }
  return (
    <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-200 ring-1 ring-emerald-500/25">
      OK
    </span>
  );
}
