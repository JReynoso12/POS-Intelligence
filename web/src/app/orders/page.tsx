"use client";

import { format } from "date-fns";
import { useEffect, useState } from "react";
import type { SaleOrder } from "@/lib/types";
import { money } from "@/lib/format";

export default function OrdersPage() {
  const [orders, setOrders] = useState<SaleOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/sales?limit=100")
      .then((r) => {
        if (!r.ok) throw new Error(`Request failed (${r.status})`);
        return r.json();
      })
      .then((j) => {
        if (!cancelled) setOrders(j.orders ?? []);
      })
      .catch((e) => {
        if (!cancelled) {
          setErr(e instanceof Error ? e.message : "Could not load orders");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return <p className="text-zinc-500">Loading orders…</p>;
  }
  if (err) {
    return <p className="text-rose-300">{err}</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-white">Orders</h2>
        <p className="text-sm text-zinc-500">
          Recent sales with line items — newest first.
        </p>
      </div>

      {orders.length === 0 ? (
        <p className="rounded-2xl border border-white/10 bg-white/5 px-4 py-6 text-zinc-400">
          No orders yet. Record a quick sale from Inventory or import CSV
          history.
        </p>
      ) : (
        <ul className="space-y-4">
          {orders.map((o) => (
            <li
              key={o.id}
              className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-4"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-sm text-zinc-400">
                  {format(new Date(o.created_at), "yyyy-MM-dd HH:mm")}
                </p>
                <p className="text-lg font-semibold text-white">
                  {money(o.total)}
                </p>
              </div>
              <ul className="mt-3 space-y-1.5 text-sm text-zinc-300">
                {o.items.map((it, idx) => (
                  <li
                    key={`${o.id}-${it.product_id}-${idx}`}
                    className="flex flex-wrap justify-between gap-2 border-t border-white/5 pt-1.5 first:border-0 first:pt-0"
                  >
                    <span>
                      {it.product_name}{" "}
                      <span className="text-zinc-500">
                        × {it.quantity} @ {money(it.unit_price)}
                      </span>
                    </span>
                    <span className="text-zinc-400">{money(it.line_total)}</span>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
