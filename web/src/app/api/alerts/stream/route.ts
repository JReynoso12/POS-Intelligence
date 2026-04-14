import { getMemoryStore } from "@/lib/memory-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      const store = getMemoryStore();

      const send = () => {
        try {
          const list = store.alerts
            .filter((a) => !a.resolved)
            .sort(
              (a, b) =>
                new Date(b.created_at).getTime() -
                new Date(a.created_at).getTime(),
            );
          const payload = JSON.stringify({
            alerts: list.map((a) => ({
              id: a.id,
              product_id: a.product_id,
              alert_type: a.alert_type,
              message: a.message,
              created_at: a.created_at,
            })),
          });
          controller.enqueue(encoder.encode(`data: ${payload}\n\n`));
        } catch {
          /* closed */
        }
      };

      send();
      const unsub = store.subscribeAlerts(send);

      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: ping\n\n`));
        } catch {
          clearInterval(heartbeat);
        }
      }, 30000);

      request.signal.addEventListener("abort", () => {
        clearInterval(heartbeat);
        unsub();
        try {
          controller.close();
        } catch {
          /* ignore */
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
