"use client";

import { useEffect, useMemo, useState } from "react";
import { RecordSale } from "@/components/record-sale";

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

type Draft = { low: string; price: string };

function serverStrings(row: Row) {
  const low = String(row.low_stock_threshold);
  const price =
    row.product.selling_price != null ? String(row.product.selling_price) : "";
  return { low, price };
}

export default function InventoryPage() {
  const [items, setItems] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [catalogVersion, setCatalogVersion] = useState(0);
  /** Per-row typed stock delta (applied via Apply, not saved with Save changes) */
  const [adjustDraft, setAdjustDraft] = useState<Record<string, string>>({});

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

  /** Merge server data with in-progress edits (keeps drafts when only quantity changed). */
  useEffect(() => {
    if (items.length === 0) {
      setDrafts({});
      return;
    }
    setDrafts((prev) => {
      const next: Record<string, Draft> = {};
      for (const row of items) {
        const pid = row.product_id;
        const { low: serverLow, price: serverPrice } = serverStrings(row);
        const old = prev[pid];
        if (old) {
          const wasDirty =
            old.low !== serverLow || old.price.trim() !== serverPrice;
          if (wasDirty) {
            next[pid] = old;
            continue;
          }
        }
        next[pid] = { low: serverLow, price: serverPrice };
      }
      return next;
    });
  }, [items]);

  const dirty = useMemo(() => {
    return items.some((row) => {
      const d = drafts[row.product_id];
      if (!d) return false;
      const { low: sLow, price: sPrice } = serverStrings(row);
      return d.low !== sLow || d.price.trim() !== sPrice;
    });
  }, [items, drafts]);

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

  async function applyStockAdjust(productId: string) {
    const raw = (adjustDraft[productId] ?? "").trim();
    if (raw === "") return;
    const v = Number(raw);
    if (!Number.isFinite(v) || v === 0) return;
    await patch(productId, { adjust: v });
    setAdjustDraft((prev) => ({ ...prev, [productId]: "" }));
  }

  async function saveAll() {
    setSaveError(null);
    setSaving(true);
    try {
      for (const row of items) {
        const d = drafts[row.product_id];
        if (!d) continue;
        const { low: sLow, price: sPrice } = serverStrings(row);
        if (d.low === sLow && d.price.trim() === sPrice) continue;

        const lowNum = Number(d.low);
        if (Number.isNaN(lowNum) || lowNum < 0) {
          setSaveError(`Invalid low-stock value for ${row.product.name}`);
          return;
        }
        const raw = d.price.trim();
        const priceVal = raw === "" ? null : Number(raw);
        if (priceVal !== null && (Number.isNaN(priceVal) || priceVal < 0)) {
          setSaveError(`Invalid price for ${row.product.name}`);
          return;
        }

        const inv = await fetch(`/api/inventory/${row.product_id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ low_stock_threshold: lowNum }),
        });
        const pr = await fetch(`/api/products/${row.product_id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ selling_price: priceVal }),
        });
        if (!inv.ok || !pr.ok) {
          setSaveError(`Could not save ${row.product.name}`);
          return;
        }
      }
      await load();
      setCatalogVersion((v) => v + 1);
    } finally {
      setSaving(false);
    }
  }

  function setDraft(productId: string, field: keyof Draft, value: string) {
    setDrafts((prev) => {
      const row = items.find((r) => r.product_id === productId);
      const base: Draft =
        prev[productId] ??
        (row
          ? {
              low: String(row.low_stock_threshold),
              price:
                row.product.selling_price != null
                  ? String(row.product.selling_price)
                  : "",
            }
          : { low: "", price: "" });
      return { ...prev, [productId]: { ...base, [field]: value } };
    });
  }

  return (
    <div className="space-y-6">
      <RecordSale onRecorded={load} catalogVersion={catalogVersion} />
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-white">Inventory</h2>
          <p className="text-sm text-zinc-500">
            Edit thresholds and prices below, then click{" "}
            <span className="text-zinc-400">Save changes</span>. Stock changes
            (custom amount, +10, −1) apply immediately — save catalog edits first
            if you edited those rows.
          </p>
        </div>
        <button
          type="button"
          disabled={!dirty || saving}
          onClick={() => void saveAll()}
          className="shrink-0 rounded-xl bg-emerald-500/25 px-5 py-2.5 text-sm font-medium text-emerald-200 ring-1 ring-emerald-500/40 hover:bg-emerald-500/35 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {saving ? "Saving…" : "Save changes"}
        </button>
      </div>
      {saveError && (
        <p className="text-sm text-rose-300" role="alert">
          {saveError}
        </p>
      )}

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
                <th className="px-4 py-3">Stock ±</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {items.map((row) => {
                const d = drafts[row.product_id] ?? {
                  low: String(row.low_stock_threshold),
                  price:
                    row.product.selling_price != null
                      ? String(row.product.selling_price)
                      : "",
                };
                return (
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
                        value={d.low}
                        onChange={(e) =>
                          setDraft(row.product_id, "low", e.target.value)
                        }
                        className="w-20 rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-zinc-100"
                        aria-label={`Low stock threshold for ${row.product.name}`}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="number"
                        min={0}
                        step={0.01}
                        value={d.price}
                        onChange={(e) =>
                          setDraft(row.product_id, "price", e.target.value)
                        }
                        className="w-28 rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-zinc-100"
                        aria-label={`Selling price for ${row.product.name}`}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={row.status} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <input
                          type="number"
                          step="any"
                          placeholder="±qty"
                          value={adjustDraft[row.product_id] ?? ""}
                          onChange={(e) =>
                            setAdjustDraft((prev) => ({
                              ...prev,
                              [row.product_id]: e.target.value,
                            }))
                          }
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              void applyStockAdjust(row.product_id);
                            }
                          }}
                          className="w-24 rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-zinc-100 placeholder:text-zinc-600"
                          aria-label={`Stock change for ${row.product.name}`}
                        />
                        <button
                          type="button"
                          className="rounded-lg bg-emerald-500/30 px-2 py-1 text-xs font-medium text-emerald-100 ring-1 ring-emerald-500/40 hover:bg-emerald-500/40"
                          onClick={() => void applyStockAdjust(row.product_id)}
                        >
                          Apply
                        </button>
                        <button
                          type="button"
                          className="rounded-lg bg-white/10 px-2 py-1 text-xs hover:bg-white/15"
                          onClick={() => void patch(row.product_id, { adjust: -1 })}
                        >
                          −1
                        </button>
                        <button
                          type="button"
                          className="rounded-lg bg-emerald-500/20 px-2 py-1 text-xs text-emerald-200 hover:bg-emerald-500/30"
                          onClick={() => void patch(row.product_id, { adjust: 10 })}
                        >
                          +10
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
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
