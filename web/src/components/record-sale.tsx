"use client";

import { useEffect, useMemo, useState } from "react";
import { money } from "@/lib/format";

type Product = {
  id: string;
  name: string;
  sku: string | null;
  selling_price: number | null;
};

export function RecordSale({
  onRecorded,
  catalogVersion = 0,
}: {
  onRecorded?: () => void;
  /** Increment when product prices change so defaults stay in sync */
  catalogVersion?: number;
}) {
  const [products, setProducts] = useState<Product[]>([]);
  const [productId, setProductId] = useState("");
  const [qty, setQty] = useState(1);
  const [price, setPrice] = useState<number | "">("");
  const [msg, setMsg] = useState<string | null>(null);

  /** Stable primitive so the dependency array length never changes between renders. */
  const catalogVersionKey = catalogVersion ?? 0;

  /** String fingerprint so price sync runs when prices load/update without putting `products[]` in useEffect deps. */
  const catalogFingerprint = useMemo(
    () =>
      products.map((p) => `${p.id}:${p.selling_price ?? "x"}`).join("|"),
    [products],
  );

  useEffect(() => {
    let cancelled = false;
    fetch("/api/products")
      .then((r) => r.json())
      .then((j) => {
        if (cancelled) return;
        const list = j.products ?? [];
        setProducts(list);
        if (list[0]) {
          setProductId((prev) => {
            const still = list.some((p: Product) => p.id === prev);
            return still ? prev : list[0].id;
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [catalogVersionKey]);

  useEffect(() => {
    const p = products.find((x) => x.id === productId);
    if (p && p.selling_price != null) setPrice(p.selling_price);
  }, [productId, catalogVersionKey, catalogFingerprint]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    const unit = typeof price === "number" ? price : Number(price);
    if (!productId || !Number.isFinite(unit) || qty <= 0) {
      setMsg("Check quantity and price.");
      return;
    }
    const r = await fetch("/api/sales", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: [{ product_id: productId, quantity: qty, unit_price: unit }],
      }),
    });
    if (!r.ok) {
      setMsg("Sale failed");
      return;
    }
    setMsg("Sale recorded — inventory updated.");
    onRecorded?.();
  }

  return (
    <form
      onSubmit={submit}
      className="rounded-2xl border border-white/10 bg-white/[0.04] p-5"
    >
      <h3 className="font-semibold text-white">Quick sale</h3>
      <p className="text-sm text-zinc-500">
        Deducts stock and refreshes alerts (same as POS line item).
      </p>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
        <label className="flex flex-1 flex-col gap-1 text-sm">
          <span className="text-zinc-500">Product</span>
          <select
            value={productId}
            onChange={(e) => setProductId(e.target.value)}
            className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-zinc-100"
          >
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} {p.sku ? `(${p.sku})` : ""}
              </option>
            ))}
          </select>
        </label>
        <label className="flex w-28 flex-col gap-1 text-sm">
          <span className="text-zinc-500">Qty</span>
          <input
            type="number"
            min={1}
            step={1}
            value={qty}
            onChange={(e) => setQty(Number(e.target.value))}
            className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-zinc-100"
          />
        </label>
        <label className="flex w-36 flex-col gap-1 text-sm">
          <span className="text-zinc-500">Unit price</span>
          <input
            type="number"
            min={0}
            step={0.01}
            value={price}
            onChange={(e) =>
              setPrice(e.target.value === "" ? "" : Number(e.target.value))
            }
            className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-zinc-100"
          />
        </label>
        <button
          type="submit"
          className="rounded-xl bg-emerald-500/90 px-5 py-2 text-sm font-medium text-emerald-950 hover:bg-emerald-400"
        >
          Record
        </button>
      </div>
      {msg && <p className="mt-3 text-sm text-emerald-300">{msg}</p>}
      {products[0]?.selling_price != null && (
        <p className="mt-2 text-xs text-zinc-600">
          Suggested: {money(products.find((p) => p.id === productId)?.selling_price ?? 0)}
        </p>
      )}
    </form>
  );
}
