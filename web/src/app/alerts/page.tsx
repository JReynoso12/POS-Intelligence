"use client";

import { useEffect, useState } from "react";
import type { AlertType } from "@/lib/types";

type AlertRow = {
  id: string;
  product_id: string;
  alert_type: AlertType;
  message: string;
  created_at: string;
};

const labels: Record<AlertType, { icon: string; color: string }> = {
  low_stock: { icon: "⚠️", color: "text-amber-200" },
  stockout: { icon: "🚨", color: "text-rose-200" },
  fast_moving: { icon: "📈", color: "text-emerald-200" },
  slow_moving: { icon: "📉", color: "text-sky-200" },
};

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<AlertRow[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const r = await fetch("/api/alerts");
    const j = await r.json();
    setAlerts(j.alerts ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function resolve(id: string) {
    await fetch("/api/alerts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ alert_id: id }),
    });
    await load();
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-white">Smart inventory alerts</h2>
        <p className="text-sm text-zinc-500">
          Low stock, stockouts, velocity spikes, and slow movers — refreshed when
          sales or inventory change.
        </p>
      </div>

      {loading ? (
        <p className="text-zinc-500">Loading…</p>
      ) : alerts.length === 0 ? (
        <p className="rounded-2xl border border-white/10 bg-white/5 px-4 py-6 text-zinc-400">
          No active alerts. Great job — or try adjusting thresholds on Inventory.
        </p>
      ) : (
        <ul className="space-y-3">
          {alerts.map((a) => {
            const meta = labels[a.alert_type];
            return (
              <li
                key={a.id}
                className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex gap-3">
                  <span className="text-2xl" aria-hidden>
                    {meta.icon}
                  </span>
                  <div>
                    <p
                      className={`text-sm font-semibold uppercase tracking-wide ${meta.color}`}
                    >
                      {a.alert_type.replace("_", " ")}
                    </p>
                    <p className="text-zinc-100">{a.message}</p>
                    <p className="text-xs text-zinc-500">
                      {new Date(a.created_at).toLocaleString()}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => resolve(a.id)}
                  className="self-start rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-sm text-zinc-200 hover:bg-white/10"
                >
                  Dismiss
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
