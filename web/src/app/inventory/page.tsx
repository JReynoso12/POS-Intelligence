"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useAppRole } from "@/components/app-role-context";
import { PageLoadingSkeleton } from "@/components/page-loading-skeleton";
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
    category: string | null;
    selling_price: number | null;
  };
  status: "ok" | "low" | "out";
};

type Draft = { low: string; price: string; category: string };

function serverStrings(row: Row) {
  const low = String(row.low_stock_threshold);
  const price =
    row.product.selling_price != null ? String(row.product.selling_price) : "";
  const category = row.product.category ?? "";
  return { low, price, category };
}

export default function InventoryPage() {
  return (
    <Suspense fallback={<PageLoadingSkeleton variant="table" />}>
      <InventoryPageInner />
    </Suspense>
  );
}

function InventoryPageInner() {
  const searchParams = useSearchParams();
  const focusId = searchParams.get("focus");

  const [items, setItems] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [catalogVersion, setCatalogVersion] = useState(0);
  const [adjustDraft, setAdjustDraft] = useState<Record<string, string>>({});
  const [adjustReason, setAdjustReason] = useState<Record<string, string>>({});
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState({
    name: "",
    sku: "",
    category: "",
    selling_price: "",
    cost_price: "",
    initial_stock: "0",
    low_stock_threshold: "5",
  });
  const [addError, setAddError] = useState<string | null>(null);
  const rowRefs = useRef<Record<string, HTMLTableRowElement | null>>({});

  const { role, status: roleStatus } = useAppRole();
  const isCashier = roleStatus === "ready" && role === "cashier";

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

  useEffect(() => {
    if (!focusId || items.length === 0) return;
    const el = rowRefs.current[focusId];
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add("ring-2", "ring-emerald-500/50");
      const t = window.setTimeout(() => {
        el.classList.remove("ring-2", "ring-emerald-500/50");
      }, 2500);
      return () => window.clearTimeout(t);
    }
  }, [focusId, items]);

  useEffect(() => {
    if (items.length === 0) {
      setDrafts({});
      return;
    }
    setDrafts((prev) => {
      const next: Record<string, Draft> = {};
      for (const row of items) {
        const pid = row.product_id;
        const { low: serverLow, price: serverPrice, category: serverCat } =
          serverStrings(row);
        const old = prev[pid];
        if (old) {
          const wasDirty =
            old.low !== serverLow ||
            old.price.trim() !== serverPrice ||
            old.category !== serverCat;
          if (wasDirty) {
            next[pid] = old;
            continue;
          }
        }
        next[pid] = { low: serverLow, price: serverPrice, category: serverCat };
      }
      return next;
    });
  }, [items]);

  const dirty = useMemo(() => {
    return items.some((row) => {
      const d = drafts[row.product_id];
      if (!d) return false;
      const { low: sLow, price: sPrice, category: sCat } = serverStrings(row);
      return (
        d.low !== sLow ||
        d.price.trim() !== sPrice ||
        d.category !== sCat
      );
    });
  }, [items, drafts]);

  async function patch(
    productId: string,
    body: { adjust?: number; low_stock_threshold?: number; adjust_reason?: string },
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
    const reason = (adjustReason[productId] ?? "").trim();
    await patch(productId, {
      adjust: v,
      adjust_reason: reason || undefined,
    });
    setAdjustDraft((prev) => ({ ...prev, [productId]: "" }));
    setAdjustReason((prev) => ({ ...prev, [productId]: "" }));
  }

  async function saveAll() {
    setSaveError(null);
    setSaving(true);
    try {
      for (const row of items) {
        const d = drafts[row.product_id];
        if (!d) continue;
        const { low: sLow, price: sPrice, category: sCat } = serverStrings(row);
        if (
          d.low === sLow &&
          d.price.trim() === sPrice &&
          d.category === sCat
        ) {
          continue;
        }

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
          body: JSON.stringify({
            selling_price: priceVal,
            category: d.category.trim() === "" ? null : d.category.trim(),
          }),
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

  function setDraft(
    productId: string,
    field: keyof Draft,
    value: string,
  ) {
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
              category: row.product.category ?? "",
            }
          : { low: "", price: "", category: "" });
      return { ...prev, [productId]: { ...base, [field]: value } };
    });
  }

  async function deleteProduct(productId: string, name: string) {
    if (!window.confirm(`Delete “${name}”? This cannot be undone if the SKU has no sales.`)) {
      return;
    }
    const r = await fetch(`/api/products/${productId}`, { method: "DELETE" });
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      window.alert((j as { error?: string }).error ?? "Delete failed");
      return;
    }
    await load();
    setCatalogVersion((v) => v + 1);
  }

  async function submitAddProduct(e: React.FormEvent) {
    e.preventDefault();
    setAddError(null);
    const selling =
      addForm.selling_price.trim() === ""
        ? null
        : Number(addForm.selling_price);
    const cost =
      addForm.cost_price.trim() === "" ? null : Number(addForm.cost_price);
    if (!addForm.name.trim()) {
      setAddError("Name is required.");
      return;
    }
    if (selling != null && (Number.isNaN(selling) || selling < 0)) {
      setAddError("Invalid selling price.");
      return;
    }
    const stock = Number(addForm.initial_stock);
    const low = Number(addForm.low_stock_threshold);
    if (Number.isNaN(stock) || stock < 0 || Number.isNaN(low) || low < 0) {
      setAddError("Invalid stock or threshold.");
      return;
    }
    const r = await fetch("/api/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: addForm.name.trim(),
        sku: addForm.sku.trim() === "" ? null : addForm.sku.trim(),
        category: addForm.category.trim() === "" ? null : addForm.category.trim(),
        cost_price: cost,
        selling_price: selling,
        initial_stock: stock,
        low_stock_threshold: low,
      }),
    });
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      setAddError((j as { error?: string }).error ?? "Could not add product");
      return;
    }
    setShowAdd(false);
    setAddForm({
      name: "",
      sku: "",
      category: "",
      selling_price: "",
      cost_price: "",
      initial_stock: "0",
      low_stock_threshold: "5",
    });
    await load();
    setCatalogVersion((v) => v + 1);
  }

  return (
    <div className="space-y-6">
      <RecordSale
        onRecorded={load}
        catalogVersion={catalogVersion}
        readOnlyPrices={isCashier}
      />

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-white">Inventory</h2>
          <p className="text-sm text-zinc-500">
            Edit category, thresholds, and prices, then{" "}
            <span className="text-zinc-400">Save changes</span>. Stock
            adjustments apply immediately — optionally add a reason for your
            records.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {!isCashier && (
            <button
              type="button"
              onClick={() => setShowAdd(true)}
              className="rounded-xl border border-emerald-500/35 bg-emerald-500/15 px-4 py-2 text-sm font-medium text-emerald-100 hover:bg-emerald-500/25"
            >
              Add product
            </button>
          )}
          <button
            type="button"
            disabled={!dirty || saving || isCashier}
            onClick={() => void saveAll()}
            className="shrink-0 rounded-xl bg-emerald-500/25 px-5 py-2.5 text-sm font-medium text-emerald-200 ring-1 ring-emerald-500/40 hover:bg-emerald-500/35 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>

      {showAdd && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          role="dialog"
          aria-modal
          aria-labelledby="add-product-title"
        >
          <form
            onSubmit={submitAddProduct}
            className="w-full max-w-md space-y-3 rounded-2xl border border-white/10 bg-[#0c0f0e] p-6 shadow-xl"
          >
            <h3 id="add-product-title" className="text-lg font-semibold text-white">
              Add product
            </h3>
            {addError && (
              <p className="text-sm text-rose-300" role="alert">
                {addError}
              </p>
            )}
            <label className="block text-sm">
              <span className="text-zinc-500">Name</span>
              <input
                required
                value={addForm.name}
                onChange={(e) =>
                  setAddForm((f) => ({ ...f, name: e.target.value }))
                }
                className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-zinc-100"
              />
            </label>
            <label className="block text-sm">
              <span className="text-zinc-500">SKU</span>
              <input
                value={addForm.sku}
                onChange={(e) =>
                  setAddForm((f) => ({ ...f, sku: e.target.value }))
                }
                className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-zinc-100"
              />
            </label>
            <label className="block text-sm">
              <span className="text-zinc-500">Category</span>
              <input
                value={addForm.category}
                onChange={(e) =>
                  setAddForm((f) => ({ ...f, category: e.target.value }))
                }
                className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-zinc-100"
              />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-sm">
                <span className="text-zinc-500">Selling price</span>
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  value={addForm.selling_price}
                  onChange={(e) =>
                    setAddForm((f) => ({ ...f, selling_price: e.target.value }))
                  }
                  className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-zinc-100"
                />
              </label>
              <label className="block text-sm">
                <span className="text-zinc-500">Cost (optional)</span>
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  value={addForm.cost_price}
                  onChange={(e) =>
                    setAddForm((f) => ({ ...f, cost_price: e.target.value }))
                  }
                  className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-zinc-100"
                />
              </label>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-sm">
                <span className="text-zinc-500">Initial stock</span>
                <input
                  type="number"
                  min={0}
                  value={addForm.initial_stock}
                  onChange={(e) =>
                    setAddForm((f) => ({ ...f, initial_stock: e.target.value }))
                  }
                  className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-zinc-100"
                />
              </label>
              <label className="block text-sm">
                <span className="text-zinc-500">Low-stock at</span>
                <input
                  type="number"
                  min={0}
                  value={addForm.low_stock_threshold}
                  onChange={(e) =>
                    setAddForm((f) => ({
                      ...f,
                      low_stock_threshold: e.target.value,
                    }))
                  }
                  className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-zinc-100"
                />
              </label>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowAdd(false)}
                className="rounded-lg border border-white/10 px-4 py-2 text-sm text-zinc-300 hover:bg-white/5"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-lg bg-emerald-500/90 px-4 py-2 text-sm font-medium text-emerald-950 hover:bg-emerald-400"
              >
                Create
              </button>
            </div>
          </form>
        </div>
      )}

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
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">On hand</th>
                <th className="px-4 py-3">Low at</th>
                <th className="px-4 py-3">Price</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Stock ±</th>
                {!isCashier && <th className="px-4 py-3"> </th>}
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
                  category: row.product.category ?? "",
                };
                return (
                  <tr
                    key={row.product_id}
                    ref={(el) => {
                      rowRefs.current[row.product_id] = el;
                    }}
                    className="bg-black/10 transition-shadow"
                  >
                    <td className="px-4 py-3 font-medium text-zinc-100">
                      {row.product.name}
                    </td>
                    <td className="px-4 py-3 text-zinc-500">
                      {row.product.sku ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="text"
                        disabled={isCashier}
                        value={d.category}
                        onChange={(e) =>
                          setDraft(row.product_id, "category", e.target.value)
                        }
                        className="w-32 rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-zinc-100 disabled:opacity-50"
                        aria-label={`Category for ${row.product.name}`}
                      />
                    </td>
                    <td className="px-4 py-3">{row.quantity}</td>
                    <td className="px-4 py-3">
                      <input
                        type="number"
                        min={0}
                        disabled={isCashier}
                        value={d.low}
                        onChange={(e) =>
                          setDraft(row.product_id, "low", e.target.value)
                        }
                        className="w-20 rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-zinc-100 disabled:opacity-50"
                        aria-label={`Low stock threshold for ${row.product.name}`}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="number"
                        min={0}
                        step={0.01}
                        disabled={isCashier}
                        value={d.price}
                        onChange={(e) =>
                          setDraft(row.product_id, "price", e.target.value)
                        }
                        className="w-28 rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-zinc-100 disabled:opacity-50"
                        aria-label={`Selling price for ${row.product.name}`}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={row.status} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex min-w-[14rem] flex-col gap-2">
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
                        </div>
                        <input
                          type="text"
                          placeholder="Reason (e.g. delivery, spoilage)"
                          value={adjustReason[row.product_id] ?? ""}
                          onChange={(e) =>
                            setAdjustReason((prev) => ({
                              ...prev,
                              [row.product_id]: e.target.value,
                            }))
                          }
                          className="w-full rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs text-zinc-200 placeholder:text-zinc-600"
                        />
                      </div>
                    </td>
                    {!isCashier && (
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          className="text-xs text-rose-300 hover:underline"
                          onClick={() =>
                            void deleteProduct(row.product_id, row.product.name)
                          }
                        >
                          Delete
                        </button>
                      </td>
                    )}
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
