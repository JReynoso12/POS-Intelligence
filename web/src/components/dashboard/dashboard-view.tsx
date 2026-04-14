"use client";

import { format } from "date-fns";
import { useCallback, useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { DashboardPayload } from "@/lib/types";
import { money, moneyAxis } from "@/lib/format";

const chartColors = ["#34d399", "#2dd4bf", "#a78bfa", "#fbbf24", "#fb7185"];

export function DashboardView() {
  const [data, setData] = useState<DashboardPayload | null>(null);
  const [trendDays, setTrendDays] = useState<7 | 30>(30);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/dashboard")
      .then((r) => r.json())
      .then(setData)
      .catch(() => setErr("Could not load dashboard"));
  }, []);

  const exportCsv = useCallback(() => {
    if (!data) return;
    const rows: string[][] = [
      ["Section", "Metric", "Value"],
      ["Sales today", "Amount", String(data.kpis.totalSalesToday)],
      ["Sales 7d", "Amount", String(data.kpis.totalSalesWeek)],
      ["Sales 30d", "Amount", String(data.kpis.totalSalesMonth)],
    ];
    for (const p of data.trend) {
      rows.push(["Trend", p.date, String(p.sales)]);
    }
    for (const c of data.categoryPerformance) {
      rows.push(["Category", c.category, String(c.revenue)]);
    }
    const esc = (s: string) =>
      /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    const body = rows.map((r) => r.map(esc).join(",")).join("\n");
    const blob = new Blob([body], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `dashboard-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [data]);

  if (err) {
    return (
      <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-red-200">
        {err}
      </p>
    );
  }
  if (!data) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-28 rounded-2xl bg-white/5" />
        <div className="h-80 rounded-2xl bg-white/5" />
      </div>
    );
  }

  const { kpis } = data;
  const trendSlice =
    trendDays === 30 ? data.trend : data.trend.slice(-7);

  const kpiCards: {
    label: string;
    value: string;
    sub: string;
    compare?: string;
    muted?: boolean;
  }[] = [
    {
      label: "Sales today",
      value: money(kpis.totalSalesToday),
      sub: `${kpis.orderCountToday} orders`,
      compare: data.kpiCompare.todayVsYesterday.summary,
    },
    {
      label: "Sales (7d rolling)",
      value: money(kpis.totalSalesWeek),
      sub: `${kpis.orderCountWeek} orders`,
      compare: data.kpiCompare.weekVsPriorWeek.summary,
    },
    {
      label: "Sales (30d rolling)",
      value: money(kpis.totalSalesMonth),
      sub: `${kpis.orderCountMonth} orders`,
      compare: data.kpiCompare.monthVsPriorMonth.summary,
    },
    {
      label: "Gross profit (30d)",
      value:
        kpis.grossProfitMonth != null
          ? money(kpis.grossProfitMonth)
          : "Add cost on products",
      sub: kpis.hasCostData ? "From cost vs price" : "Set cost_price on SKUs",
      muted: !kpis.hasCostData,
    },
    {
      label: "Low stock SKUs",
      value: String(kpis.lowStockCount),
      sub: "Below threshold",
    },
    {
      label: "Out of stock",
      value: String(kpis.outOfStockCount),
      sub: "Needs restock",
    },
  ];

  const topCount = data.topProducts.length;
  const topTitle =
    topCount >= 5
      ? "Top 5 products (30d)"
      : topCount === 0
        ? "Top products (30d)"
        : `Top products (30d) — ${topCount} with sales`;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap justify-end">
        <button
          type="button"
          onClick={exportCsv}
          className="rounded-full border border-white/15 bg-emerald-500/15 px-4 py-2 text-sm font-medium text-emerald-200 ring-1 ring-emerald-500/30 hover:bg-emerald-500/25"
        >
          Export CSV
        </button>
      </div>

      {data.sameSalesTotalsHint && (
        <p className="rounded-xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          {data.sameSalesTotalsHint}
        </p>
      )}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {kpiCards.map((c) => (
          <div
            key={c.label}
            className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.07] to-transparent p-5 shadow-[0_0_0_1px_rgba(16,185,129,0.08)]"
          >
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">
              {c.label}
            </p>
            <p
              className={`mt-2 text-2xl font-semibold ${c.muted ? "text-zinc-400" : "text-white"}`}
            >
              {c.value}
            </p>
            <p className="mt-1 text-sm text-zinc-500">{c.sub}</p>
            {c.compare && (
              <p className="mt-2 text-xs text-zinc-500">{c.compare}</p>
            )}
          </div>
        ))}
      </section>

      <section className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 lg:col-span-2">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-white">
                Sales trend
              </h2>
              <p className="text-sm text-zinc-500">
                Revenue by day — switch 7 / 30 days
              </p>
            </div>
            <div className="flex gap-2">
              {([7, 30] as const).map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setTrendDays(d)}
                  className={`rounded-full px-3 py-1 text-sm ${
                    trendDays === d
                      ? "bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/40"
                      : "bg-white/5 text-zinc-400 hover:bg-white/10"
                  }`}
                >
                  {d}d
                </button>
              ))}
            </div>
          </div>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendSlice}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff14" />
                <XAxis dataKey="date" stroke="#71717a" fontSize={12} />
                <YAxis
                  stroke="#71717a"
                  fontSize={12}
                  tickFormatter={(v) => moneyAxis(Number(v))}
                  label={{
                    value: "Revenue (PHP)",
                    angle: -90,
                    position: "insideLeft",
                    fill: "#71717a",
                    fontSize: 11,
                  }}
                />
                <Tooltip
                  formatter={(v: number | string) =>
                    money(typeof v === "number" ? v : Number(v))
                  }
                  contentStyle={{
                    background: "#0c0f0e",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: 12,
                  }}
                  labelStyle={{ color: "#e4e4e7" }}
                />
                <Line
                  type="monotone"
                  dataKey="sales"
                  name="Revenue"
                  stroke="#34d399"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <h2 className="text-base font-semibold text-white">
            Category revenue
          </h2>
          <p className="text-sm text-zinc-500">Last 30 days</p>
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.categoryPerformance} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff14" />
                <XAxis
                  type="number"
                  stroke="#71717a"
                  fontSize={12}
                  tickFormatter={(v) => moneyAxis(Number(v))}
                />
                <YAxis
                  type="category"
                  dataKey="category"
                  width={88}
                  stroke="#71717a"
                  fontSize={11}
                />
                <Tooltip
                  contentStyle={{
                    background: "#0c0f0e",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: 12,
                  }}
                />
                <Bar dataKey="revenue" radius={[0, 6, 6, 0]}>
                  {data.categoryPerformance.map((_, i) => (
                    <Cell
                      key={i}
                      fill={chartColors[i % chartColors.length]}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <h2 className="text-base font-semibold text-white">{topTitle}</h2>
          <p className="text-sm text-zinc-500">By units sold</p>
          <div className="mt-4 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.topProducts}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff14" />
                <XAxis dataKey="name" stroke="#71717a" fontSize={11} />
                <YAxis
                  stroke="#71717a"
                  fontSize={12}
                  label={{
                    value: "Units sold",
                    angle: -90,
                    position: "insideLeft",
                    fill: "#71717a",
                    fontSize: 11,
                  }}
                />
                <Tooltip
                  contentStyle={{
                    background: "#0c0f0e",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: 12,
                  }}
                />
                <Bar dataKey="units_sold" fill="#34d399" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <h2 className="text-base font-semibold text-white">
            Slowest movers (30d)
          </h2>
          <p className="text-sm text-zinc-500">
            Lowest units sold among SKUs with at least one sale — not vs. stock
            on hand. A high-margin item can still rank high in revenue while
            moving fewer units than others.
          </p>
          <ul className="mt-4 space-y-3">
            {data.worstProducts.map((p) => (
              <li
                key={p.product_id}
                className="flex items-center justify-between rounded-xl border border-white/5 bg-black/20 px-4 py-3"
              >
                <span className="font-medium text-zinc-200">{p.name}</span>
                <span className="text-sm text-zinc-500">
                  {p.units_sold} units · {money(p.revenue)}
                </span>
              </li>
            ))}
            {data.worstProducts.length === 0 && (
              <li className="text-zinc-500">No sales in range.</li>
            )}
          </ul>
        </div>
      </section>
    </div>
  );
}
