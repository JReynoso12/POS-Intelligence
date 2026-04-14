import { NextResponse } from "next/server";
import { money } from "@/lib/format";
import { getMemoryStore, type MemoryStore } from "@/lib/memory-store";

function buildEmailHtml(summary: ReturnType<MemoryStore["getDailySummary"]>) {
  const top = summary.topProduct
    ? `${summary.topProduct.name} (${summary.topProduct.units_sold} units)`
    : "—";
  const low = summary.lowStock.length
    ? summary.lowStock
        .map((l) => `<li>${l.name}: ${l.qty} (threshold ${l.threshold})</li>`)
        .join("")
    : "<li>None</li>";
  const restock = summary.restockSuggestions.length
    ? summary.restockSuggestions.map((r) => `<li>${r}</li>`).join("")
    : "<li>None</li>";
  return `
  <h1>Daily business summary — ${summary.date}</h1>
  <p><strong>Total sales:</strong> ${money(summary.totalSales)}</p>
  <p><strong>Orders:</strong> ${summary.orders}</p>
  <p><strong>Top product:</strong> ${top}</p>
  <h2>Low stock</h2>
  <ul>${low}</ul>
  <h2>Suggested restock</h2>
  <ul>${restock}</ul>
  `;
}

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  const cronAuthorized = Boolean(
    secret && auth === `Bearer ${secret}`,
  );

  const store = getMemoryStore();
  const summary = store.getDailySummary();
  const html = buildEmailHtml(summary);

  const resendKey = process.env.RESEND_API_KEY;
  const to = process.env.DAILY_REPORT_EMAIL;

  // Only the scheduled job (Bearer CRON_SECRET) may trigger email. The Reports
  // UI loads this route without auth and must still receive the JSON summary.
  if (resendKey && to && cronAuthorized) {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM ?? "POS Intelligence <onboarding@resend.dev>",
        to: [to],
        subject: `Daily report — ${summary.date}`,
        html,
      }),
    });
    if (!r.ok) {
      const err = await r.text();
      return NextResponse.json(
        { error: "Resend failed", detail: err, summary },
        { status: 502 },
      );
    }
    return NextResponse.json({ sent: true, summary, html });
  }

  const message =
    resendKey && to && !cronAuthorized
      ? "Email is sent only by the cron job (Authorization: Bearer CRON_SECRET). Summary below is live."
      : "Set RESEND_API_KEY and DAILY_REPORT_EMAIL to enable email. Summary included.";

  return NextResponse.json({
    sent: false,
    message,
    summary,
    html,
  });
}
