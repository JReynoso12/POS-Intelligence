import {
  addDays,
  endOfDay,
  format,
  isAfter,
  isBefore,
  setHours,
  startOfDay,
  subDays,
} from "date-fns";
import type {
  ActionableAlert,
  AlertRecord,
  AlertType,
  CategoryPerf,
  DashboardPayload,
  IntelligenceSnapshot,
  InventoryRow,
  Product,
  RecentSaleRow,
  Sale,
  SaleItem,
  SmartInsight,
  TopProduct,
  TrendPoint,
} from "./types";
import { money } from "./format";

function uid(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `id_${Math.random().toString(36).slice(2)}_${Date.now()}`;
}

function iso(d: Date): string {
  return d.toISOString();
}

export function stableAlertId(alert_type: AlertType, productId: string): string {
  return `${alert_type}::${productId}`;
}

export class MemoryStore {
  products: Product[] = [];
  inventory: InventoryRow[] = [];
  sales: Sale[] = [];
  saleItems: SaleItem[] = [];
  alerts: AlertRecord[] = [];
  /** Keys `${alert_type}:${product_id}` — skip auto alert if user dismissed it */
  dismissalKeys = new Set<string>();

  private alertSubscribers = new Set<() => void>();

  /** Subscribe to alert list changes (for SSE / realtime UI). */
  subscribeAlerts(cb: () => void): () => void {
    this.alertSubscribers.add(cb);
    return () => {
      this.alertSubscribers.delete(cb);
    };
  }

  private emitAlertsChanged() {
    for (const cb of this.alertSubscribers) {
      try {
        cb();
      } catch {
        /* ignore */
      }
    }
  }

  seed() {
    const now = new Date();
    const mkProduct = (
      name: string,
      sku: string,
      category: string,
      cost: number,
      price: number,
    ): Product => ({
      id: uid(),
      name,
      sku,
      category,
      cost_price: cost,
      selling_price: price,
      created_at: iso(subDays(now, 60)),
    });

    const p1 = mkProduct("Milk 1L", "MLK-1L", "Dairy", 0.8, 1.4);
    const p2 = mkProduct("Chicken Breast 1kg", "CHK-BR", "Meat", 4.5, 8.99);
    const p3 = mkProduct("Rice 25kg", "RICE-25", "Staples", 18, 32.5);
    const p4 = mkProduct("Eggs 12pc", "EGG-12", "Dairy", 1.2, 2.5);
    const p5 = mkProduct("Cooking Oil 2L", "OIL-2L", "Staples", 3.1, 5.49);
    const p6 = mkProduct("Sparkling Water 500ml", "H2O-05", "Beverages", 0.35, 0.99);

    this.products = [p1, p2, p3, p4, p5, p6];

    this.inventory = [
      {
        product_id: p1.id,
        quantity: 4,
        low_stock_threshold: 5,
        updated_at: iso(now),
      },
      {
        product_id: p2.id,
        quantity: 0,
        low_stock_threshold: 3,
        updated_at: iso(now),
      },
      {
        product_id: p3.id,
        quantity: 40,
        low_stock_threshold: 8,
        updated_at: iso(now),
      },
      {
        product_id: p4.id,
        quantity: 24,
        low_stock_threshold: 10,
        updated_at: iso(now),
      },
      {
        product_id: p5.id,
        quantity: 14,
        low_stock_threshold: 6,
        updated_at: iso(now),
      },
      {
        product_id: p6.id,
        quantity: 120,
        low_stock_threshold: 20,
        updated_at: iso(now),
      },
    ];

    this.sales = [];
    this.saleItems = [];
    this.alerts = [];

    // Synthetic sales for charts & velocity (last 35 days)
    for (let d = 0; d < 35; d++) {
      const day = startOfDay(subDays(now, d));
      const orders = 8 + (d % 5);
      for (let o = 0; o < orders; o++) {
        const saleId = uid();
        const items: { pid: string; q: number; price: number }[] = [];
        const pick = (idx: number, q: number) => {
          if (d < 14 && idx === 5) return;
          const pr = this.products[idx];
          const price = pr.selling_price ?? 1;
          items.push({ pid: pr.id, q, price });
        };
        if (d < 10) {
          pick(2, 2 + (o % 3));
          pick(0, 3);
        } else if (d < 20) {
          pick(4, 1);
          pick(3, 2);
        } else {
          pick(5, 4);
          pick(1, 1);
        }
        if (o % 4 === 0) pick(2, 1);

        let total = 0;
        const created = addDays(day, o * 60000);
        for (const it of items) {
          const line = it.q * it.price;
          total += line;
          this.saleItems.push({
            id: uid(),
            sale_id: saleId,
            product_id: it.pid,
            quantity: it.q,
            unit_price: it.price,
          });
        }
        this.sales.push({
          id: saleId,
          total: Math.round(total * 100) / 100,
          created_at: iso(created),
        });
      }
    }

    this.refreshAlerts();
  }

  private saleOf(saleId: string): Sale | undefined {
    return this.sales.find((s) => s.id === saleId);
  }

  getProduct(id: string): Product | undefined {
    return this.products.find((p) => p.id === id);
  }

  sumSalesInRange(start: Date, end: Date): { revenue: number; orders: number } {
    let revenue = 0;
    let orders = 0;
    for (const s of this.sales) {
      const t = new Date(s.created_at);
      if (!isBefore(t, start) && !isAfter(t, end)) {
        revenue += s.total;
        orders += 1;
      }
    }
    return { revenue, orders };
  }

  profitInRange(start: Date, end: Date): number | null {
    let profit = 0;
    let anyCost = false;
    for (const s of this.sales) {
      const t = new Date(s.created_at);
      if (isBefore(t, start) || isAfter(t, end)) continue;
      const items = this.saleItems.filter((si) => si.sale_id === s.id);
      for (const si of items) {
        const p = this.getProduct(si.product_id);
        const cost = p?.cost_price;
        if (cost != null) {
          anyCost = true;
          profit += si.quantity * (si.unit_price - cost);
        }
      }
    }
    return anyCost ? Math.round(profit * 100) / 100 : null;
  }

  unitsSoldProduct(productId: string, start: Date, end: Date): number {
    let u = 0;
    for (const si of this.saleItems) {
      if (si.product_id !== productId) continue;
      const s = this.saleOf(si.sale_id);
      if (!s) continue;
      const t = new Date(s.created_at);
      if (!isBefore(t, start) && !isAfter(t, end)) u += si.quantity;
    }
    return u;
  }

  topWorstProducts(
    start: Date,
    end: Date,
    mode: "top" | "worst",
    limit: number,
  ): TopProduct[] {
    const map = new Map<string, { units: number; revenue: number }>();
    for (const si of this.saleItems) {
      const s = this.saleOf(si.sale_id);
      if (!s) continue;
      const t = new Date(s.created_at);
      if (isBefore(t, start) || isAfter(t, end)) continue;
      const cur = map.get(si.product_id) ?? { units: 0, revenue: 0 };
      cur.units += si.quantity;
      cur.revenue += si.quantity * si.unit_price;
      map.set(si.product_id, cur);
    }
    const rows: TopProduct[] = [];
    for (const [product_id, v] of map) {
      const p = this.getProduct(product_id);
      if (!p) continue;
      rows.push({
        product_id,
        name: p.name,
        units_sold: Math.round(v.units * 100) / 100,
        revenue: Math.round(v.revenue * 100) / 100,
      });
    }
    rows.sort((a, b) =>
      mode === "top"
        ? b.units_sold - a.units_sold
        : a.units_sold - b.units_sold,
    );
    return rows.slice(0, limit);
  }

  categoryPerformance(start: Date, end: Date): CategoryPerf[] {
    const map = new Map<string, { revenue: number; units: number }>();
    for (const si of this.saleItems) {
      const s = this.saleOf(si.sale_id);
      if (!s) continue;
      const t = new Date(s.created_at);
      if (isBefore(t, start) || isAfter(t, end)) continue;
      const p = this.getProduct(si.product_id);
      const cat = p?.category ?? "Uncategorized";
      const cur = map.get(cat) ?? { revenue: 0, units: 0 };
      cur.revenue += si.quantity * si.unit_price;
      cur.units += si.quantity;
      map.set(cat, cur);
    }
    return [...map.entries()]
      .map(([category, v]) => ({
        category,
        revenue: Math.round(v.revenue * 100) / 100,
        units: Math.round(v.units * 100) / 100,
      }))
      .sort((a, b) => b.revenue - a.revenue);
  }

  salesTrend(days: number): TrendPoint[] {
    const now = new Date();
    const start = startOfDay(subDays(now, days - 1));
    const points: TrendPoint[] = [];
    for (let i = 0; i < days; i++) {
      const day = addDays(start, i);
      const { revenue, orders } = this.sumSalesInRange(
        startOfDay(day),
        endOfDay(day),
      );
      points.push({
        date: format(day, "MMM d"),
        sales: Math.round(revenue * 100) / 100,
        orders,
      });
    }
    return points;
  }

  getDashboard(): DashboardPayload {
    const now = new Date();
    const startToday = startOfDay(now);
    const endToday = endOfDay(now);
    const startWeek = startOfDay(subDays(now, 6));
    const startMonth = startOfDay(subDays(now, 29));

    const tw = this.sumSalesInRange(startWeek, endToday);
    const tm = this.sumSalesInRange(startMonth, endToday);
    const td = this.sumSalesInRange(startToday, endToday);

    const hasCost = this.products.some((p) => p.cost_price != null);
    const gpToday = this.profitInRange(startToday, endToday);
    const gpWeek = this.profitInRange(startWeek, endToday);
    const gpMonth = this.profitInRange(startMonth, endToday);

    let low = 0;
    let out = 0;
    for (const inv of this.inventory) {
      if (inv.quantity <= 0) out += 1;
      else if (inv.quantity < inv.low_stock_threshold) low += 1;
    }

    return {
      kpis: {
        totalSalesToday: Math.round(td.revenue * 100) / 100,
        totalSalesWeek: Math.round(tw.revenue * 100) / 100,
        totalSalesMonth: Math.round(tm.revenue * 100) / 100,
        orderCountToday: td.orders,
        orderCountWeek: tw.orders,
        orderCountMonth: tm.orders,
        grossProfitToday: gpToday,
        grossProfitWeek: gpWeek,
        grossProfitMonth: gpMonth,
        hasCostData: hasCost,
        lowStockCount: low,
        outOfStockCount: out,
      },
      topProducts: this.topWorstProducts(startMonth, endToday, "top", 5),
      worstProducts: this.topWorstProducts(startMonth, endToday, "worst", 5),
      trend: this.salesTrend(30),
      categoryPerformance: this.categoryPerformance(startMonth, endToday),
    };
  }

  getInventory(): (InventoryRow & { product: Product })[] {
    return this.inventory
      .map((inv) => {
        const product = this.getProduct(inv.product_id)!;
        return { ...inv, product };
      })
      .sort((a, b) => a.product.name.localeCompare(b.product.name));
  }

  statusFor(inv: InventoryRow): "ok" | "low" | "out" {
    if (inv.quantity <= 0) return "out";
    if (inv.quantity < inv.low_stock_threshold) return "low";
    return "ok";
  }

  recordSale(
    items: { product_id: string; quantity: number; unit_price: number }[],
    at: Date = new Date(),
  ): Sale {
    const saleId = uid();
    let total = 0;
    for (const it of items) {
      const line = it.quantity * it.unit_price;
      total += line;
      this.saleItems.push({
        id: uid(),
        sale_id: saleId,
        product_id: it.product_id,
        quantity: it.quantity,
        unit_price: it.unit_price,
      });
      const inv = this.inventory.find((i) => i.product_id === it.product_id);
      if (inv) {
        inv.quantity = Math.max(0, inv.quantity - it.quantity);
        inv.updated_at = iso(at);
      }
    }
    const sale: Sale = {
      id: saleId,
      total: Math.round(total * 100) / 100,
      created_at: iso(at),
    };
    this.sales.push(sale);
    this.refreshAlerts();
    return sale;
  }

  adjustStock(productId: string, quantityDelta: number) {
    const inv = this.inventory.find((i) => i.product_id === productId);
    if (!inv) return;
    inv.quantity = Math.max(0, inv.quantity + quantityDelta);
    inv.updated_at = iso(new Date());
    this.refreshAlerts();
  }

  setThreshold(productId: string, threshold: number) {
    const inv = this.inventory.find((i) => i.product_id === productId);
    if (!inv) return;
    inv.low_stock_threshold = Math.max(0, threshold);
    inv.updated_at = iso(new Date());
    this.refreshAlerts();
  }

  importSaleRows(
    rows: {
      date: string;
      sku?: string;
      product_name?: string;
      quantity: number;
      unit_price: number;
    }[],
  ): { imported: number; errors: string[] } {
    const errors: string[] = [];
    let imported = 0;
    for (const row of rows) {
      const t = new Date(row.date);
      if (Number.isNaN(t.getTime())) {
        errors.push(`Bad date: ${row.date}`);
        continue;
      }
      let product: Product | undefined;
      if (row.sku) {
        product = this.products.find(
          (p) => p.sku?.toLowerCase() === row.sku!.toLowerCase(),
        );
      }
      if (!product && row.product_name) {
        product = this.products.find(
          (p) => p.name.toLowerCase() === row.product_name!.toLowerCase(),
        );
      }
      if (!product) {
        errors.push(`Unknown product: ${row.sku ?? row.product_name ?? "?"}`);
        continue;
      }
      this.recordSale(
        [
          {
            product_id: product.id,
            quantity: row.quantity,
            unit_price: row.unit_price,
          },
        ],
        t,
      );
      imported += 1;
    }
    return { imported, errors };
  }

  refreshAlerts() {
    this.alerts = this.alerts.filter((a) => a.source === "manual");
    const now = new Date();
    const startThis = subDays(now, 7);
    const startPrev = subDays(now, 14);
    const endPrev = subDays(now, 7);
    const slowCut = subDays(now, 14);

    const push = (
      productId: string,
      alert_type: AlertType,
      message: string,
      meta?: Record<string, unknown>,
    ) => {
      const dkey = `${alert_type}:${productId}`;
      if (this.dismissalKeys.has(dkey)) return;
      this.alerts.push({
        id: stableAlertId(alert_type, productId),
        product_id: productId,
        alert_type,
        message,
        meta: meta ?? null,
        resolved: false,
        source: "auto",
        created_at: iso(now),
      });
    };

    for (const inv of this.inventory) {
      const p = this.getProduct(inv.product_id);
      if (!p) continue;
      if (inv.quantity <= 0) {
        push(inv.product_id, "stockout", `${p.name} is OUT OF STOCK`);
      } else if (inv.quantity < inv.low_stock_threshold) {
        push(
          inv.product_id,
          "low_stock",
          `${p.name} is below ${inv.low_stock_threshold} units (${Math.round(inv.quantity)} left)`,
        );
      }
    }

    for (const p of this.products) {
      const thisWeek = this.unitsSoldProduct(p.id, startThis, now);
      const prevWeek = this.unitsSoldProduct(p.id, startPrev, endPrev);
      if (prevWeek >= 3 && thisWeek >= 2 * prevWeek) {
        push(
          p.id,
          "fast_moving",
          `${p.name} is selling 2× faster this week vs last week`,
          { this_week: thisWeek, last_week: prevWeek },
        );
      }
    }

    for (const p of this.products) {
      const inv = this.inventory.find((i) => i.product_id === p.id);
      if (!inv || inv.quantity <= 0) continue;
      const soldRecently = this.saleItems.some((si) => {
        if (si.product_id !== p.id) return false;
        const s = this.saleOf(si.sale_id);
        return s && !isBefore(new Date(s.created_at), slowCut);
      });
      if (!soldRecently) {
        push(
          p.id,
          "slow_moving",
          `${p.name} hasn’t sold in 14 days`,
        );
      }
    }
    this.emitAlertsChanged();
  }

  resolveAlert(alertId: string) {
    const a = this.alerts.find((x) => x.id === alertId);
    if (a) {
      a.resolved = true;
      if (a.source === "auto") {
        const dkey = `${a.alert_type}:${a.product_id}`;
        this.dismissalKeys.add(dkey);
      }
    }
    this.emitAlertsChanged();
  }

  private avgOrderValue(start: Date, end: Date): number {
    const { revenue, orders } = this.sumSalesInRange(start, end);
    return orders > 0 ? Math.round((revenue / orders) * 100) / 100 : 0;
  }

  private pctChange(today: number, yesterday: number): number | null {
    if (yesterday === 0 && today === 0) return 0;
    if (yesterday === 0) return null;
    return Math.round(((today - yesterday) / yesterday) * 1000) / 10;
  }

  /** Best contiguous 3-hour window today by revenue (for “peak hours” insight). */
  private bestHourWindowToday(): { label: string; revenue: number } | null {
    const start = startOfDay(new Date());
    const end = endOfDay(new Date());
    const hourTotals = new Array(24).fill(0);
    for (const s of this.sales) {
      const t = new Date(s.created_at);
      if (isBefore(t, start) || isAfter(t, end)) continue;
      hourTotals[t.getHours()] += s.total;
    }
    let bestH = -1;
    let bestSum = 0;
    for (let h = 0; h <= 21; h++) {
      const sum = hourTotals[h] + hourTotals[h + 1] + hourTotals[h + 2];
      if (sum > bestSum) {
        bestSum = sum;
        bestH = h;
      }
    }
    if (bestH < 0 || bestSum <= 0) return null;
    const d0 = setHours(start, bestH);
    const d1 = setHours(start, bestH + 3);
    return {
      label: `${format(d0, "h a")} – ${format(d1, "h a")}`,
      revenue: Math.round(bestSum * 100) / 100,
    };
  }

  getIntelligenceSnapshot(): IntelligenceSnapshot {
    const now = new Date();
    const startToday = startOfDay(now);
    const endToday = endOfDay(now);
    const yStart = startOfDay(subDays(now, 1));
    const yEnd = endOfDay(subDays(now, 1));
    const start7 = startOfDay(subDays(now, 6));
    const start14 = startOfDay(subDays(now, 13));

    const dashboard = this.getDashboard();
    const td = this.sumSalesInRange(startToday, endToday);
    const yd = this.sumSalesInRange(yStart, yEnd);
    const gpToday = this.profitInRange(startToday, endToday);
    const gpYesterday = this.profitInRange(yStart, yEnd);

    const avgToday = this.avgOrderValue(startToday, endToday);
    const avgY = this.avgOrderValue(yStart, yEnd);

    const vsYesterday = {
      revenuePct: this.pctChange(td.revenue, yd.revenue),
      ordersPct: this.pctChange(td.orders, yd.orders),
      profitPct:
        gpToday != null && gpYesterday != null
          ? this.pctChange(gpToday, gpYesterday)
          : null,
      avgOrderPct: this.pctChange(avgToday, avgY),
      yesterdayRevenue: Math.round(yd.revenue * 100) / 100,
      yesterdayOrders: yd.orders,
    };

    const actionableAlerts: ActionableAlert[] = [];
    for (const inv of this.inventory) {
      const p = this.getProduct(inv.product_id);
      if (!p) continue;
      if (inv.quantity <= 0) {
        actionableAlerts.push({
          id: `out-${p.id}`,
          severity: "critical",
          title: "Out of stock",
          detail: `${p.name} — restock before you lose sales.`,
        });
      } else if (inv.quantity < inv.low_stock_threshold) {
        actionableAlerts.push({
          id: `low-${p.id}`,
          severity: "warning",
          title: "Low stock",
          detail: `${p.name} (${Math.round(inv.quantity)} left, threshold ${inv.low_stock_threshold}).`,
        });
      }
    }
    const revPct = vsYesterday.revenuePct;
    if (revPct != null && revPct <= -10) {
      actionableAlerts.push({
        id: "sales-drop",
        severity: "warning",
        title: "Sales dipped vs yesterday",
        detail: `Revenue is ${Math.abs(revPct)}% below yesterday — check traffic or promotions.`,
      });
    }
    const topT = this.topWorstProducts(startToday, endToday, "top", 1)[0];
    if (topT) {
      actionableAlerts.push({
        id: "top-today",
        severity: "success",
        title: "Top product today",
        detail: `${topT.name} · ${topT.units_sold} units sold.`,
      });
    }

    const insights: SmartInsight[] = [];
    const peak = this.bestHourWindowToday();
    if (peak) {
      insights.push({
        id: "peak-hours",
        text: `Best time today: ${peak.label} (${money(peak.revenue)} sales in that window).`,
        kind: "trend",
      });
    }

    for (const p of this.products) {
      const inv = this.inventory.find((i) => i.product_id === p.id);
      if (!inv || inv.quantity <= 0) continue;
      const sold7 = this.unitsSoldProduct(p.id, start7, endToday);
      const daily = sold7 / 7;
      if (daily <= 0.01) continue;
      const daysLeft = inv.quantity / daily;
      if (daysLeft < 2 && daysLeft >= 0) {
        insights.push({
          id: `runout-${p.id}`,
          text: `You may run out of ${p.name} in ~${Math.max(1, Math.ceil(daysLeft))} day(s) at current pace.`,
          kind: "risk",
        });
        break;
      }
    }

    let weekendSum = 0;
    let weekendDays = 0;
    let weekdaySum = 0;
    let weekdayDays = 0;
    for (let d = 0; d < 14; d++) {
      const day = addDays(start14, d);
      const dow = day.getDay();
      const { revenue } = this.sumSalesInRange(startOfDay(day), endOfDay(day));
      if (dow === 0 || dow === 6) {
        weekendSum += revenue;
        weekendDays += 1;
      } else {
        weekdaySum += revenue;
        weekdayDays += 1;
      }
    }
    const avgWe = weekendDays > 0 ? weekendSum / weekendDays : 0;
    const avgWd = weekdayDays > 0 ? weekdaySum / weekdayDays : 0;
    if (avgWe > 0 && avgWd > 0 && avgWe > avgWd * 1.08) {
      insights.push({
        id: "weekend-up",
        text: "Weekend daily average is running above weekdays — consider extra staff or stock before Sat–Sun.",
        kind: "opportunity",
      });
    }

    const recentSales: RecentSaleRow[] = [...this.sales]
      .sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      )
      .slice(0, 12)
      .map((s) => ({
        id: s.id,
        at: s.created_at,
        total: s.total,
        itemCount: this.saleItems.filter((si) => si.sale_id === s.id).length,
      }));

    const topProductsToday = this.topWorstProducts(
      startToday,
      endToday,
      "top",
      6,
    );
    const categoryLast7Days = this.categoryPerformance(start7, endToday);
    const trend7Days = this.salesTrend(7);

    const fastRows = this.topWorstProducts(start7, endToday, "top", 5);
    const fastMoving = fastRows.map((r) => ({
      product_id: r.product_id,
      name: r.name,
      units_7d: r.units_sold,
    }));

    const deadStock: { product_id: string; name: string; qty: number }[] = [];
    for (const inv of this.inventory) {
      if (inv.quantity <= 0) continue;
      const sold14 = this.unitsSoldProduct(inv.product_id, start14, endToday);
      if (sold14 === 0) {
        const p = this.getProduct(inv.product_id);
        if (p)
          deadStock.push({
            product_id: p.id,
            name: p.name,
            qty: inv.quantity,
          });
      }
    }
    deadStock.sort((a, b) => b.qty - a.qty);

    return {
      dashboard,
      vsYesterday,
      avgOrderToday: avgToday,
      avgOrderYesterday: avgY,
      actionableAlerts,
      insights,
      recentSales,
      topProductsToday,
      categoryLast7Days,
      trend7Days,
      fastMoving,
      deadStock: deadStock.slice(0, 8),
      dailySummary: this.getDailySummary(),
      serverTime: now.toISOString(),
    };
  }

  getDailySummary(): {
    date: string;
    totalSales: number;
    orders: number;
    topProduct: TopProduct | null;
    lowStock: { name: string; qty: number; threshold: number }[];
    restockSuggestions: string[];
  } {
    const now = new Date();
    const start = startOfDay(now);
    const end = endOfDay(now);
    const { revenue, orders } = this.sumSalesInRange(start, end);
    const tops = this.topWorstProducts(start, end, "top", 1);
    const lowStock = this.inventory
      .filter((i) => i.quantity > 0 && i.quantity < i.low_stock_threshold)
      .map((i) => {
        const p = this.getProduct(i.product_id);
        return {
          name: p?.name ?? "Unknown",
          qty: i.quantity,
          threshold: i.low_stock_threshold,
        };
      });
    const out = this.inventory.filter((i) => i.quantity <= 0);
    const restock: string[] = [
      ...out.map((i) => {
        const p = this.getProduct(i.product_id);
        return `Restock ${p?.name ?? "?"} (stockout)`;
      }),
      ...lowStock.map((l) => `Order more ${l.name} (below ${l.threshold})`),
    ];
    return {
      date: format(now, "yyyy-MM-dd"),
      totalSales: Math.round(revenue * 100) / 100,
      orders,
      topProduct: tops[0] ?? null,
      lowStock,
      restockSuggestions: restock.slice(0, 12),
    };
  }
}

const globalKey = "__pos_intel_demo_store__" as const;

/** Seeded in-memory store — only when USE_DEMO_DATA=1 (local demos). */
export function getDemoMemoryStore(): MemoryStore {
  const g = globalThis as unknown as Record<string, MemoryStore | undefined>;
  if (!g[globalKey]) {
    const s = new MemoryStore();
    s.seed();
    g[globalKey] = s;
  }
  return g[globalKey]!;
}

/** @deprecated Use getAppStore() for real data */
export function getMemoryStore(): MemoryStore {
  if (process.env.USE_DEMO_DATA === "1") {
    return getDemoMemoryStore();
  }
  throw new Error(
    "getMemoryStore() requires USE_DEMO_DATA=1 — use getAppStore() instead",
  );
}
