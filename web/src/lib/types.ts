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
  topProducts: TopProduct[];
  worstProducts: TopProduct[];
  trend: TrendPoint[];
  categoryPerformance: CategoryPerf[];
};
