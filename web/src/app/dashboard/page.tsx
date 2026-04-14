import { DashboardView } from "@/components/dashboard/dashboard-view";

export default function DashboardPage() {
  return (
    <div className="space-y-2">
      <p className="text-sm text-zinc-500">
        Live KPIs, trends, and category mix — demo data runs in-memory until you
        wire Supabase.
      </p>
      <DashboardView />
    </div>
  );
}
