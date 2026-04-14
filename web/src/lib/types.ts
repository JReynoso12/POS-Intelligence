/** UI + API role for owner vs cashier workflows */
export type AppRole = "owner" | "cashier";

export type AlertType =
  | "low_stock"
  | "stockout"
  | "fast_moving"
  | "slow_moving";

export type Product = {
  id: string;
  name: string;
  sku: string | null;
  category: string | null;
  cost_price: number | null;
  selling_price: number | null;
  created_at: string;
};

export type InventoryRow = {
  product_id: string;
  quantity: number;
  low_stock_threshold: number;
  updated_at: string;
};

export type Sale = {
  id: string;
  total: number;
  created_at: string;
};

export type SaleItem = {
  id: string;
  sale_id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
};

export type AlertRecord = {
  id: string;
  product_id: string;
  alert_type: AlertType;
  message: string;
  meta: Record<string, unknown> | null;
  resolved: boolean;
  source: "auto" | "manual";
  created_at: string;
};

export type TopProduct = {
  product_id: string;
  name: string;
  units_sold: number;
  revenue: number;
};

export type TrendPoint = {
  date: string;
  sales: number;
  orders: number;
};

export type CategoryPerf = {
  category: string;
  revenue: number;
  units: number;
};

export type KpiCompareLine = {
  /** Short line for UI, e.g. "+12% vs yesterday (₱50.00)" */
  summary: string;
};

export type DashboardPayload = {
  kpis: {
    totalSalesToday: number;
    totalSalesWeek: number;
    totalSalesMonth: number;
    orderCountToday: number;
    orderCountWeek: number;
    orderCountMonth: number;
    grossProfitToday: number | null;
    grossProfitWeek: number | null;
    grossProfitMonth: number | null;
    hasCostData: boolean;
    lowStockCount: number;
    outOfStockCount: number;
  };
  /** Rolling comparisons so Today / 7d / 30d are distinguishable */
  kpiCompare: {
    todayVsYesterday: KpiCompareLine;
    weekVsPriorWeek: KpiCompareLine;
    monthVsPriorMonth: KpiCompareLine;
  };
  /** When all three sales KPIs match because data is only from today */
  sameSalesTotalsHint: string | null;
  topProducts: TopProduct[];
  worstProducts: TopProduct[];
  trend: TrendPoint[];
  categoryPerformance: CategoryPerf[];
};

export type SaleOrderLine = {
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  line_total: number;
};

export type SaleOrder = {
  id: string;
  created_at: string;
  total: number;
  items: SaleOrderLine[];
};

export type VsYesterday = {
  revenuePct: number | null;
  ordersPct: number | null;
  profitPct: number | null;
  avgOrderPct: number | null;
  yesterdayRevenue: number;
  yesterdayOrders: number;
};

export type ActionableAlert = {
  id: string;
  severity: "critical" | "warning" | "success" | "info";
  title: string;
  detail: string;
  /** When set, UI can link to Inventory for this product */
  product_id?: string;
};

export type SmartInsight = {
  id: string;
  text: string;
  kind: "opportunity" | "risk" | "trend";
};

export type RecentSaleRow = {
  id: string;
  at: string;
  total: number;
  itemCount: number;
};

export type IntelligenceSnapshot = {
  dashboard: DashboardPayload;
  vsYesterday: VsYesterday;
  avgOrderToday: number;
  avgOrderYesterday: number;
  actionableAlerts: ActionableAlert[];
  insights: SmartInsight[];
  recentSales: RecentSaleRow[];
  topProductsToday: TopProduct[];
  categoryLast7Days: CategoryPerf[];
  trend7Days: TrendPoint[];
  fastMoving: { product_id: string; name: string; units_7d: number }[];
  deadStock: { product_id: string; name: string; qty: number }[];
  dailySummary: {
    date: string;
    totalSales: number;
    orders: number;
    topProduct: TopProduct | null;
    lowStock: { name: string; qty: number; threshold: number }[];
    restockSuggestions: string[];
  };
  serverTime: string;
};
