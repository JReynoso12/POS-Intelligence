import { NextResponse } from "next/server";
import { getMemoryStore } from "@/lib/memory-store";

export async function GET() {
  const store = getMemoryStore();
  return NextResponse.json({ products: store.products });
}
