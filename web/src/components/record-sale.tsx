"use client";

import { useEffect, useMemo, useState } from "react";
import { money } from "@/lib/format";

type Product = {
  id: string;
  name: string;
  sku: string | null;
  selling_price: number | null;
};

type CartLine = {
  product_id: string;
  quantity: number;
  unit_price: number;
};

export function RecordSale({
  onRecorded,
  catalogVersion = 0,
  readOnlyPrices = false,
}: {
  onRecorded?: () => void;
  /** Increment when product prices change so defaults stay in sync */
  catalogVersion?: number;
  /** Cashier mode: hide price editing beyond unit line (still uses entered unit price) */
  readOnlyPrices?: boolean;
}) {
  const [products, setProducts] = useState<Product[]>([]);
  const [lines, setLines] = useState<CartLine[]>([]);
  const [productId, setProductId] = useState("");
  const [qty, setQty] = useState(1);
  const [price, setPrice] = useState<number | "">("");
  const [msg, setMsg] = useState<string | null>(null);

  const catalogVersionKey = catalogVersion ?? 0;

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

  const cartTotal = useMemo(() => {
    let t = 0;
    for (const l of lines) {
      t += l.quantity * l.unit_price;
    }
    return Math.round(t * 100) / 100;
  }, [lines]);

  function addLine() {
    setMsg(null);
    const unit = typeof price === "number" ? price : Number(price);
    if (!productId || !Number.isFinite(unit) || qty <= 0) {
      setMsg("Pick a product, quantity, and unit price.");
      return;
    }
    setLines((prev) => {
      const i = prev.findIndex((x) => x.product_id === productId);
      if (i >= 0) {
        const next = [...prev];
        next[i] = {
          ...next[i],
          quantity: next[i].quantity + qty,
          unit_price: unit,
        };
        return next;
      }
      return [...prev, { product_id: productId, quantity: qty, unit_price: unit }];
    });
    setQty(1);
  }

  function removeLine(product_id: string) {
    setLines((prev) => prev.filter((x) => x.product_id !== product_id));
  }

  function updateLineQty(product_id: string, quantity: number) {
    if (quantity <= 0) {
      removeLine(product_id);
      return;
    }
    setLines((prev) =>
      prev.map((x) =>
        x.product_id === product_id ? { ...x, quantity } : x,
      ),
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (lines.length === 0) {
      setMsg("Add at least one line to the cart.");
      return;
    }
    const items = lines.map((l) => ({
      product_id: l.product_id,
      quantity: l.quantity,
      unit_price: l.unit_price,
    }));
    const r = await fetch("/api/sales", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items }),
    });
    if (!r.ok) {
      setMsg("Sale failed");
      return;
    }
    setMsg("Sale recorded — inventory updated.");
    setLines([]);
    onRecorded?.();
  }

  return (
    <form
      onSubmit={submit}
      className="rounded-2xl border border-white/10 bg-white/[0.04] p-5"
    >
      <h3 className="font-semibold text-white">Quick sale</h3>
      <p className="text-sm text-zinc-500">
        Build a cart with multiple lines, then record one transaction.
      </p>

      <div className="mt-4 flex flex-col gap-3 rounded-xl border border-white/5 bg-black/20 p-4 sm:flex-row sm:items-end">
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
            readOnly={readOnlyPrices}
            onChange={(e) =>
              setPrice(e.target.value === "" ? "" : Number(e.target.value))
            }
            className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-zinc-100 read-only:opacity-80"
          />
        </label>
        <button
          type="button"
          onClick={addLine}
          className="rounded-xl bg-white/10 px-4 py-2 text-sm font-medium text-white hover:bg-white/15"
        >
          Add to cart
        </button>
      </div>

      {lines.length > 0 && (
        <ul className="mt-4 space-y-2 rounded-xl border border-white/10 bg-black/25 p-3 text-sm">
          {lines.map((l) => {
            const p = products.find((x) => x.id === l.product_id);
            const name = p?.name ?? "Product";
            const lineTotal = Math.round(l.quantity * l.unit_price * 100) / 100;
            return (
              <li
                key={l.product_id}
                className="flex flex-wrap items-center justify-between gap-2 border-b border-white/5 pb-2 last:border-0 last:pb-0"
              >
                <span className="font-medium text-zinc-200">{name}</span>
                <span className="flex flex-wrap items-center gap-2 text-zinc-400">
                  <label className="flex items-center gap-1">
                    <span className="sr-only">Quantity</span>
                    <input
                      type="number"
                      min={1}
                      className="w-16 rounded border border-white/10 bg-black/40 px-2 py-1 text-zinc-100"
                      value={l.quantity}
                      onChange={(e) =>
                        updateLineQty(l.product_id, Number(e.target.value))
                      }
                    />
                    × {money(l.unit_price)}
                  </label>
                  <span className="text-zinc-200">{money(lineTotal)}</span>
                  <button
                    type="button"
                    className="text-rose-300 hover:underline"
                    onClick={() => removeLine(l.product_id)}
                  >
                    Remove
                  </button>
                </span>
              </li>
            );
          })}
          <li className="flex justify-between pt-2 text-base font-semibold text-white">
            <span>Total</span>
            <span>{money(cartTotal)}</span>
          </li>
        </ul>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={lines.length === 0}
          className="rounded-xl bg-emerald-500/90 px-5 py-2 text-sm font-medium text-emerald-950 hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Record sale
        </button>
        {msg && <p className="text-sm text-emerald-300">{msg}</p>}
      </div>
      {products[0]?.selling_price != null && (
        <p className="mt-2 text-xs text-zinc-600">
          Suggested price:{" "}
          {money(products.find((p) => p.id === productId)?.selling_price ?? 0)}
        </p>
      )}
    </form>
  );
}
