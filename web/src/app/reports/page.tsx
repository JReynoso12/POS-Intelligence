"use client";

import { useEffect, useState } from "react";
import { money } from "@/lib/format";

type Summary = {
  date: string;
  totalSales: number;
  orders: number;
  topProduct: { name: string; units_sold: number } | null;
  lowStock: { name: string; qty: number; threshold: number }[];
  restockSuggestions: string[];
};

export default function ReportsPage() {
  const [data, setData] = useState<{
    summary: Summary;
    sent?: boolean;
    message?: string;
    html?: string;
    error?: string;
  } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  async function run() {
    setLoadError(null);
    try {
      const r = await fetch("/api/cron/daily-report");
      const j = (await r.json()) as {
        summary?: Summary;
        error?: string;
        detail?: string;
        sent?: boolean;
        message?: string;
        html?: string;
      };
      if (!r.ok) {
        if (j.summary) {
          setData({
            summary: j.summary,
            sent: j.sent,
            message: j.detail
              ? `${j.error ?? "Error"}: ${j.detail}`
              : j.error,
            html: j.html,
          });
          setLoadError(null);
        } else {
          setLoadError(j.error ?? `Request failed (${r.status})`);
          setData(null);
        }
        return;
      }
      if (!j.summary) {
        setLoadError("Invalid response: missing summary");
        setData(null);
        return;
      }
      setData({
        summary: j.summary,
        sent: j.sent,
        message: j.message,
        html: j.html,
      });
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Network error");
      setData(null);
    }
  }

  useEffect(() => {
    run();
  }, []);

  if (loadError && !data?.summary) {
    return (
      <div className="space-y-3">
        <p className="text-red-400">{loadError}</p>
        <button
          type="button"
          onClick={run}
          className="rounded-full bg-white/10 px-4 py-2 text-sm text-white hover:bg-white/15"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!data?.summary) {
    return <p className="text-zinc-500">Loading report…</p>;
  }

  const s = data.summary;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-white">Daily business summary</h2>
          <p className="text-sm text-zinc-500">
            Mirrors the 8:00 PM automation. Configure{" "}
            <code className="text-emerald-300">RESEND_API_KEY</code>,{" "}
            <code className="text-emerald-300">DAILY_REPORT_EMAIL</code>, and{" "}
            <code className="text-emerald-300">CRON_SECRET</code> for production.
          </p>
        </div>
        <button
          type="button"
          onClick={run}
          className="rounded-full bg-white/10 px-4 py-2 text-sm text-white hover:bg-white/15"
        >
          Refresh
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
          <p className="text-xs uppercase tracking-wide text-zinc-500">
            Total sales (today)
          </p>
          <p className="mt-2 text-2xl font-semibold text-white">
            {money(s.totalSales)}
          </p>
          <p className="text-sm text-zinc-500">{s.orders} orders</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 md:col-span-2">
          <p className="text-xs uppercase tracking-wide text-zinc-500">
            Top product
          </p>
          <p className="mt-2 text-lg font-medium text-zinc-100">
            {s.topProduct
              ? `${s.topProduct.name} · ${s.topProduct.units_sold} units`
              : "—"}
          </p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
          <h3 className="font-semibold text-white">Low stock</h3>
          <ul className="mt-3 space-y-2 text-sm text-zinc-300">
            {s.lowStock.map((l) => (
              <li key={l.name}>
                {l.name}: {l.qty} (threshold {l.threshold})
              </li>
            ))}
            {s.lowStock.length === 0 && (
              <li className="text-zinc-500">None</li>
            )}
          </ul>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
          <h3 className="font-semibold text-white">Restock suggestions</h3>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-zinc-300">
            {s.restockSuggestions.map((r) => (
              <li key={r}>{r}</li>
            ))}
            {s.restockSuggestions.length === 0 && (
              <li className="list-none text-zinc-500">None</li>
            )}
          </ul>
        </div>
      </div>

      {data.message && (
        <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          {data.message}
        </p>
      )}

      {data.html && (
        <details className="rounded-2xl border border-white/10 bg-black/30 p-4">
          <summary className="cursor-pointer text-sm text-zinc-400">
            Preview HTML email
          </summary>
          <div
            className="prose prose-invert mt-4 max-w-none text-sm"
            dangerouslySetInnerHTML={{ __html: data.html }}
          />
        </details>
      )}
    </div>
  );
}
