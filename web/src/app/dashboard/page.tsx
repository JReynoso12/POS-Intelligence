"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAppRole } from "@/components/app-role-context";
import { DashboardView } from "@/components/dashboard/dashboard-view";

export default function DashboardPage() {
  const router = useRouter();
  const { role, status } = useAppRole();

  useEffect(() => {
    if (status !== "ready") return;
    if (role === "cashier") router.replace("/inventory");
  }, [status, role, router]);

  if (status === "ready" && role === "cashier") {
    return null;
  }

  return (
    <div className="space-y-2">
      <p className="text-sm text-zinc-500">
        Live KPIs, trends, and category mix.
      </p>
      <DashboardView />
    </div>
  );
}
