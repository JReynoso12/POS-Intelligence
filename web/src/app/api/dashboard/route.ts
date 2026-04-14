import { NextResponse } from "next/server";
import { getMemoryStore } from "@/lib/memory-store";

export async function GET() {
  const store = getMemoryStore();
  const data = store.getDashboard();
  return NextResponse.json(data);
}
