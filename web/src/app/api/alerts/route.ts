import { NextResponse } from "next/server";
import { z } from "zod";
import { getMemoryStore } from "@/lib/memory-store";

export async function GET() {
  const store = getMemoryStore();
  store.refreshAlerts();
  const list = store.alerts
    .filter((a) => !a.resolved)
    .sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );
  return NextResponse.json({ alerts: list });
}

const resolveSchema = z.object({
  alert_id: z.string(),
});

export async function POST(req: Request) {
  const json = await req.json().catch(() => ({}));
  const parsed = resolveSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const store = getMemoryStore();
  store.resolveAlert(parsed.data.alert_id);
  return NextResponse.json({ ok: true });
}
