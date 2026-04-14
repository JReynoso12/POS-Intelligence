import { NextResponse } from "next/server";
import { getAppStore } from "@/lib/db/hydrate";

export async function GET() {
  try {
    const store = await getAppStore();
    return NextResponse.json(store.getDashboard());
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Server error" },
      { status: 503 },
    );
  }
}
