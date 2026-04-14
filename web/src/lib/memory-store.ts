import {
  addDays,
  endOfDay,
  format,
  isAfter,
  isBefore,
  startOfDay,
  subDays,
} from "date-fns";
import type {
  AlertRecord,
  AlertType,
  CategoryPerf,
  DashboardPayload,
  InventoryRow,
  Product,
  Sale,
  SaleItem,
  TopProduct,
  TrendPoint,
} from "./types";

function uid(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `id_${Math.random().toString(36).slice(2)}_${Date.now()}`;
}

function iso(d: Date): string {
  return d.toISOString();
}

export class MemoryStore {
  products: Product[] = [];
  inventory: InventoryRow[] = [];
  sales: Sale[] = [];
  saleItems: SaleItem[] = [];
  alerts: AlertRecord[] = [];

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
    this.alerts = this.alerts.filter(
      (a) => a.source === "manual" || a.resolved,
    );
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
      this.alerts.push({
        id: uid(),
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
    if (a) a.resolved = true;
    this.emitAlertsChanged();
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

const globalKey = "__pos_intel_store__" as const;

export function getMemoryStore(): MemoryStore {
  const g = globalThis as unknown as Record<string, MemoryStore | undefined>;
  if (!g[globalKey]) {
    const s = new MemoryStore();
    s.seed();
    g[globalKey] = s;
  }
  return g[globalKey]!;
}
