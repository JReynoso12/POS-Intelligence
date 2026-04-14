import { NextResponse } from "next/server";
import type { AppRole } from "@/lib/types";
import { createServiceClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  if (process.env.USE_DEMO_DATA === "1") {
    return NextResponse.json({ role: "owner" as AppRole });
  }

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ role: "owner" as AppRole });
    }

    const sb = createServiceClient();
    const { data, error } = await sb
      .from("app_profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    if (error || !data?.role) {
      return NextResponse.json({ role: "owner" as AppRole });
    }
    const role: AppRole = data.role === "cashier" ? "cashier" : "owner";
    return NextResponse.json({ role });
  } catch {
    return NextResponse.json({ role: "owner" as AppRole });
  }
}
