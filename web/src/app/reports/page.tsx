"use client";

import { format, formatDistanceToNow } from "date-fns";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useAppRole } from "@/components/app-role-context";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type {
  ActionableAlert,
  IntelligenceSnapshot,
  SmartInsight,
} from "@/lib/types";
import { money, moneyAxis } from "@/lib/format";

const REFRESH_MS = 8000;
const chartColors = ["#34d399", "#2dd4bf", "#a78bfa", "#fbbf24", "#fb7185", "#94a3b8"];

function TrendPct({
  v,
  baselineWasZero,
  baselineLabel,
}: {
  v: number | null;
  /** When true and v is null, show friendly copy instead of an em dash */
  baselineWasZero?: boolean;
  baselineLabel?: string;
}) {
  if (v === null) {
    if (baselineWasZero) {
      return (
        <span className="text-zinc-400">
          {baselineLabel ?? "No activity yesterday"}
        </span>
      );
    }
    return <span className="text-zinc-500">—</span>;
  }
  if (v === 0) {
    return <span className="text-zinc-400">0%</span>;
  }
  const up = v > 0;
  return (
    <span
      className={`inline-flex items-center gap-0.5 font-medium tabular-nums ${up ? "text-emerald-400" : "text-rose-400"}`}
    >
      {up ? "↑" : "↓"} {up ? "+" : ""}
      {v}%
      <span className="sr-only"> vs yesterday</span>
    </span>
  );
}

function alertClass(severity: ActionableAlert["severity"]) {
  switch (severity) {
    case "critical":
      return "border-rose-500/35 bg-rose-500/10";
    case "warning":
      return "border-amber-500/35 bg-amber-500/10";
    case "success":
      return "border-emerald-500/35 bg-emerald-500/10";
    default:
      return "border-sky-500/30 bg-sky-500/10";
  }
}

function insightIcon(kind: SmartInsight["kind"]) {
  switch (kind) {
    case "risk":
      return "⚠️";
    case "opportunity":
      return "💡";
    default:
      return "📈";
  }
}

export default function ReportsPage() {
  const router = useRouter();
  const { role, status: roleStatus } = useAppRole();
  const [intel, setIntel] = useState<IntelligenceSnapshot | null>(null);
  const [emailBlock, setEmailBlock] = useState<{
    html?: string;
    message?: string;
    sent?: boolean;
  } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [lastSync, setLastSync] = useState<Date | null>(null);

  const loadIntel = useCallback(async () => {
    try {
      const r = await fetch("/api/intelligence");
      if (!r.ok) throw new Error(`Request failed (${r.status})`);
      const j = (await r.json()) as IntelligenceSnapshot;
      setIntel(j);
      setLoadError(null);
      setLastSync(new Date());
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Network error");
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [intelRes, emailRes] = await Promise.all([
          fetch("/api/intelligence"),
          fetch("/api/cron/daily-report"),
        ]);
        if (cancelled) return;
        if (intelRes.ok) {
          const j = (await intelRes.json()) as IntelligenceSnapshot;
          setIntel(j);
          setLoadError(null);
          setLastSync(new Date());
        } else {
          setLoadError(`Request failed (${intelRes.status})`);
        }
        const jEmail = await emailRes.json().catch(() => ({}));
        setEmailBlock({
          html: jEmail.html as string | undefined,
          message: jEmail.message as string | undefined,
          sent: jEmail.sent as boolean | undefined,
        });
      } catch (e) {
        if (!cancelled) {
          setLoadError(e instanceof Error ? e.message : "Network error");
        }
      }
    })();
    const id = setInterval(() => void loadIntel(), REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [loadIntel]);

  useEffect(() => {
    if (roleStatus !== "ready") return;
    if (role === "cashier") router.replace("/inventory");
  }, [roleStatus, role, router]);

  const exportCsv = useCallback(() => {
    if (!intel) return;
    const d = intel.dashboard;
    const kpis = d.kpis;
    const rows: string[][] = [
      ["Section", "Metric", "Value"],
      ["Today", "Revenue", String(kpis.totalSalesToday)],
      ["Today", "Orders", String(kpis.orderCountToday)],
      ["Today", "Gross profit", String(kpis.grossProfitToday ?? "")],
    ];
    for (const p of d.trend) {
      rows.push(["Trend (30d)", p.date, String(p.sales)]);
    }
    for (const c of intel.categoryLast7Days) {
      rows.push(["Category (7d)", c.category, String(c.revenue)]);
    }
    const esc = (s: string) =>
      /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    const body = rows.map((r) => r.map(esc).join(",")).join("\n");
    const blob = new Blob([body], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pos-intelligence-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [intel]);

  if (roleStatus === "ready" && role === "cashier") {
    return null;
  }

  if (loadError && !intel) {
    return (
      <div className="space-y-3">
        <p className="text-red-400">{loadError}</p>
        <button
          type="button"
          onClick={() => void loadIntel()}
          className="rounded-full bg-white/10 px-4 py-2 text-sm text-white hover:bg-white/15"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!intel) {
    return <p className="text-zinc-500">Loading intelligence…</p>;
  }

  const { dashboard: d, vsYesterday: vy } = intel;
  const kpis = d.kpis;

  const kpiMain: {
    label: string;
    value: string;
    sub: string;
    trend: number | null;
    trendLabel: string;
    /** When trend is null because the prior day had no activity */
    baselineWasZero: boolean;
    baselineHint: string;
    muted?: boolean;
  }[] = [
    {
      label: "Today's revenue",
      value: money(kpis.totalSalesToday),
      sub: `${kpis.orderCountToday} orders`,
      trend: vy.revenuePct,
      trendLabel: "vs yesterday",
      baselineWasZero: vy.yesterdayRevenue === 0,
      baselineHint:
        vy.yesterdayRevenue === 0
          ? "No sales yesterday"
          : `Yesterday ${money(vy.yesterdayRevenue)}`,
    },
    {
      label: "Orders today",
      value: String(kpis.orderCountToday),
      sub: "Transactions",
      trend: vy.ordersPct,
      trendLabel: "vs yesterday",
      baselineWasZero: vy.yesterdayOrders === 0,
      baselineHint:
        vy.yesterdayOrders === 0
          ? "No orders yesterday"
          : `Yesterday ${vy.yesterdayOrders} orders`,
    },
    {
      label: "Avg order value",
      value:
        kpis.orderCountToday > 0
          ? money(intel.avgOrderToday)
          : money(0),
      sub: "Per order today",
      trend: vy.avgOrderPct,
      trendLabel: "vs yesterday",
      baselineWasZero:
        vy.yesterdayOrders === 0 && intel.avgOrderYesterday === 0,
      baselineHint:
        vy.yesterdayOrders === 0
          ? "No orders yesterday — no AOV baseline"
          : `Yesterday avg ${money(intel.avgOrderYesterday)}`,
    },
    {
      label: "Gross profit (today)",
      value:
        kpis.grossProfitToday != null
          ? money(kpis.grossProfitToday)
          : "Add cost on products",
      sub: kpis.hasCostData ? "Cost vs price" : "Set cost_price on SKUs",
      trend: vy.profitPct,
      trendLabel: "vs yesterday",
      baselineWasZero: false,
      baselineHint: "",
      muted: !kpis.hasCostData,
    },
  ];

  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-white">
            POS Intelligence
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-zinc-500">
            Actionable alerts, live KPIs, and smart insights — backed by your
            Supabase data via the API.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-300">
            <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
            Live data
          </span>
          {lastSync && (
            <span className="text-xs text-zinc-500">
              Updated {formatDistanceToNow(lastSync, { addSuffix: true })}
            </span>
          )}
          <button
            type="button"
            onClick={() => void loadIntel()}
            className="rounded-full bg-white/10 px-4 py-2 text-sm text-white hover:bg-white/15"
          >
            Refresh now
          </button>
          <button
            type="button"
            onClick={exportCsv}
            className="rounded-full border border-white/15 bg-emerald-500/15 px-4 py-2 text-sm font-medium text-emerald-200 ring-1 ring-emerald-500/30 hover:bg-emerald-500/25"
          >
            Export CSV
          </button>
        </div>
      </div>

      <section aria-label="Quick actions">
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
          Quick actions
        </p>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/inventory"
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.06] px-4 py-2.5 text-sm font-medium text-white transition hover:border-emerald-500/40 hover:bg-emerald-500/10"
          >
            ➕ New order
          </Link>
          <Link
            href="/inventory"
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.06] px-4 py-2.5 text-sm font-medium text-white transition hover:border-emerald-500/40 hover:bg-emerald-500/10"
          >
            📦 Add stock
          </Link>
          <button
            type="button"
            title="Connect refunds to your terminal or accounting workflow"
            className="inline-flex cursor-not-allowed items-center gap-2 rounded-xl border border-white/5 bg-white/[0.03] px-4 py-2.5 text-sm text-zinc-500"
            disabled
          >
            💸 Issue refund
          </button>
        </div>
      </section>

      <section aria-label="Key metrics">
        <p className="mb-3 text-xs font-medium uppercase tracking-wide text-zinc-500">
          Today at a glance
        </p>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {kpiMain.map((c) => (
            <div
              key={c.label}
              className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.07] to-transparent p-5 shadow-[0_0_0_1px_rgba(16,185,129,0.06)]"
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
              <p className="mt-3 flex flex-wrap items-baseline gap-2 text-sm">
                <TrendPct
                  v={c.trend}
                  baselineWasZero={
                    c.trend === null && c.baselineWasZero && !c.muted
                  }
                  baselineLabel={c.baselineHint}
                />
                <span className="text-zinc-600">{c.trendLabel}</span>
              </p>
            </div>
          ))}
        </div>
      </section>

      <section aria-label="Actionable alerts" className="space-y-3">
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
          Alerts & opportunities
        </p>
        <div className="grid gap-3 md:grid-cols-2">
          {intel.actionableAlerts.map((a) => (
            <div
              key={a.id}
              className={`rounded-2xl border p-4 ${alertClass(a.severity)}`}
            >
              <p className="font-medium text-zinc-100">{a.title}</p>
              <p className="mt-1 text-sm text-zinc-300">{a.detail}</p>
              {a.product_id && (
                <p className="mt-3">
                  <Link
                    href={`/inventory?focus=${encodeURIComponent(a.product_id)}`}
                    className="text-sm font-medium text-emerald-300 underline-offset-2 hover:underline"
                  >
                    Adjust stock in Inventory →
                  </Link>
                </p>
              )}
            </div>
          ))}
        </div>
      </section>

      <section aria-label="Smart insights" className="space-y-3">
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
          Smart insights
        </p>
        <ul className="space-y-2">
          {intel.insights.map((ins) => (
            <li
              key={ins.id}
              className="flex gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-zinc-200"
            >
              <span className="shrink-0" aria-hidden>
                {insightIcon(ins.kind)}
              </span>
              <span>{ins.text}</span>
            </li>
          ))}
          {intel.insights.length === 0 && (
            <li className="text-zinc-500">No insights yet — add more sales.</li>
          )}
        </ul>
      </section>

      <section className="grid gap-6 lg:grid-cols-3" aria-label="Charts">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 lg:col-span-2">
          <h3 className="text-base font-semibold text-white">Sales trend</h3>
          <p className="text-sm text-zinc-500">Last 7 days</p>
          <div className="mt-4 h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={intel.trend7Days}>
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
          <h3 className="text-base font-semibold text-white">
            Sales by category
          </h3>
          <p className="text-sm text-zinc-500">Last 7 days</p>
          <div className="mt-4 h-64 min-h-[16rem]">
            {intel.categoryLast7Days.length === 0 ? (
              <div className="flex h-full items-center justify-center rounded-xl border border-white/5 bg-black/20 px-4 text-center text-sm text-zinc-500">
                No category sales in the last 7 days — record a sale or import
                CSV to populate this chart.
              </div>
            ) : (
              <ResponsiveContainer
                width="100%"
                height="100%"
                key={intel.categoryLast7Days
                  .map((c) => `${c.category}:${c.revenue}`)
                  .join("|")}
              >
                <PieChart>
                  <Pie
                    data={intel.categoryLast7Days}
                    dataKey="revenue"
                    nameKey="category"
                    cx="50%"
                    cy="50%"
                    innerRadius={44}
                    outerRadius={72}
                    paddingAngle={2}
                  >
                    {intel.categoryLast7Days.map((row, i) => (
                      <Cell
                        key={row.category}
                        fill={chartColors[i % chartColors.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(v: number) => money(v)}
                    contentStyle={{
                      background: "#0c0f0e",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: 12,
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 lg:col-span-3">
          <h3 className="text-base font-semibold text-white">Top products today</h3>
          <p className="text-sm text-zinc-500">By units sold</p>
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={intel.topProductsToday}>
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
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section
          className="rounded-2xl border border-white/10 bg-white/[0.03] p-5"
          aria-label="Recent transactions"
        >
          <h3 className="text-base font-semibold text-white">
            Recent transactions
          </h3>
          <p className="text-sm text-zinc-500">Newest first</p>
          <ul className="mt-4 max-h-80 space-y-2 overflow-y-auto">
            {intel.recentSales.map((s) => (
              <li
                key={s.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-white/5 bg-black/20 px-3 py-2 text-sm"
              >
                <span className="text-zinc-400">
                  {format(new Date(s.at), "HH:mm")}
                  <span className="ml-2 text-zinc-500">
                    · {s.itemCount} line{s.itemCount === 1 ? "" : "s"}
                  </span>
                </span>
                <span className="font-medium text-zinc-100">{money(s.total)}</span>
              </li>
            ))}
            {intel.recentSales.length === 0 && (
              <li className="text-zinc-500">No sales today.</li>
            )}
          </ul>
        </section>

        <section
          className="space-y-4"
          aria-label="Inventory intelligence"
        >
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <h3 className="text-base font-semibold text-white">Fast movers (7d)</h3>
            <p className="text-sm text-zinc-500">By units</p>
            <ul className="mt-3 space-y-2 text-sm">
              {intel.fastMoving.slice(0, 5).map((f) => (
                <li
                  key={f.product_id}
                  className="flex justify-between text-zinc-300"
                >
                  <span>{f.name}</span>
                  <span className="text-zinc-500">{f.units_7d} units</span>
                </li>
              ))}
              {intel.fastMoving.length === 0 && (
                <li className="text-zinc-500">No data.</li>
              )}
            </ul>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <h3 className="text-base font-semibold text-white">Dead stock</h3>
            <p className="text-sm text-zinc-500">
              On hand but no sales in 14 days
            </p>
            <ul className="mt-3 space-y-2 text-sm">
              {intel.deadStock.map((d) => (
                <li
                  key={d.product_id}
                  className="flex justify-between text-zinc-300"
                >
                  <span>{d.name}</span>
                  <span className="text-zinc-500">{d.qty} on hand</span>
                </li>
              ))}
              {intel.deadStock.length === 0 && (
                <li className="text-zinc-500">None — great turnover.</li>
              )}
            </ul>
          </div>
        </section>
      </div>

      <section
        className="rounded-2xl border border-dashed border-white/15 bg-white/[0.02] p-6"
        aria-label="Product roadmap"
      >
        <h3 className="text-base font-semibold text-white">
          Sellable capabilities
        </h3>
        <p className="mt-1 text-sm text-zinc-500">
          Roadmap items clients pay for — wire these to your backend when you
          go live.
        </p>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <li className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm">
            <span className="text-emerald-400">✓</span> Daily email reports
            <p className="mt-1 text-xs text-zinc-500">
              Cron + Resend — see preview below.
            </p>
          </li>
          <li className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm">
            <span className="text-zinc-500">○</span> SMS alerts (low stock /
            sales)
            <p className="mt-1 text-xs text-zinc-500">Twilio / SNS integration</p>
          </li>
          <li className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm">
            <span className="text-zinc-500">○</span> Multi-branch compare
            <p className="mt-1 text-xs text-zinc-500">Per-store rollups</p>
          </li>
          <li className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm">
            <span className="text-zinc-500">○</span> Export PDF / Excel
            <p className="mt-1 text-xs text-zinc-500">Reports API + workers</p>
          </li>
        </ul>
        <p className="mt-4 text-xs text-zinc-600">
          Role-based dashboards (owner vs cashier vs manager) layer on the same
          data — filter KPIs and quick actions per role in your auth layer.
        </p>
      </section>

      <section className="space-y-4" aria-label="Daily email">
        <h3 className="text-base font-semibold text-white">
          Daily email (8:00 PM automation)
        </h3>
        <p className="text-sm text-zinc-500">
          Configure{" "}
          <code className="text-emerald-300">RESEND_API_KEY</code>,{" "}
          <code className="text-emerald-300">DAILY_REPORT_EMAIL</code>, and{" "}
          <code className="text-emerald-300">CRON_SECRET</code> for production.
        </p>
        {emailBlock?.message && (
          <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
            {emailBlock.message}
          </p>
        )}
        {emailBlock?.html && (
          <details className="rounded-2xl border border-white/10 bg-black/30 p-4">
            <summary className="cursor-pointer text-sm text-zinc-400">
              Preview HTML email
            </summary>
            <div
              className="prose prose-invert mt-4 max-w-none text-sm"
              dangerouslySetInnerHTML={{ __html: emailBlock.html }}
            />
          </details>
        )}
      </section>
    </div>
  );
}
