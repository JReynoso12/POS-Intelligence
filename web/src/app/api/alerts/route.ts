import { NextResponse } from "next/server";
import { z } from "zod";
import { getAppStore } from "@/lib/db/hydrate";
import { resolveAlertInDb } from "@/lib/db/writes";

export async function GET(req: Request) {
  try {
    const store = await getAppStore();
    const url = new URL(req.url);
    if (url.searchParams.get("refresh") === "1") {
      store.refreshAlerts();
    }
    const list = store.alerts
      .filter((a) => !a.resolved)
      .sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );
    return NextResponse.json({ alerts: list });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Server error" },
      { status: 503 },
    );
  }
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

  try {
    if (process.env.USE_DEMO_DATA === "1") {
      const store = await getAppStore();
      store.resolveAlert(parsed.data.alert_id);
    } else {
      await resolveAlertInDb(parsed.data.alert_id);
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Server error" },
      { status: 503 },
    );
  }
}
