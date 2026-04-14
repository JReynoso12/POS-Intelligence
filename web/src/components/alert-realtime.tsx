"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

type StreamAlert = {
  id: string;
  product_id: string;
  alert_type: string;
  message: string;
  created_at: string;
};

type ToastItem = {
  toastId: string;
  message: string;
  alert_type: string;
};

export function AlertRealtime({
  onUnresolvedCount,
}: {
  onUnresolvedCount?: (count: number) => void;
}) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const seenKeys = useRef<Set<string>>(new Set());
  const skipFirst = useRef(true);
  const countCb = useRef(onUnresolvedCount);
  countCb.current = onUnresolvedCount;

  /** Initial count + fallback if EventSource is slow or blocked in dev. */
  useEffect(() => {
    let cancelled = false;
    async function syncCount() {
      try {
        const r = await fetch("/api/alerts");
        const j = (await r.json()) as { alerts?: StreamAlert[] };
        if (cancelled || !Array.isArray(j.alerts)) return;
        countCb.current?.(j.alerts.length);
      } catch {
        /* ignore */
      }
    }
    void syncCount();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const es = new EventSource("/api/alerts/stream");

    es.onmessage = (event) => {
      let data: { alerts: StreamAlert[] };
      try {
        data = JSON.parse(event.data);
      } catch {
        return;
      }
      const alerts = data.alerts ?? [];
      countCb.current?.(alerts.length);
      window.dispatchEvent(new CustomEvent("pos-alerts-updated"));

      const nextKeys = new Set(
        alerts.map((a) => `${a.product_id}:${a.alert_type}`),
      );

      if (skipFirst.current) {
        skipFirst.current = false;
        seenKeys.current = nextKeys;
        return;
      }

      const newOnes: ToastItem[] = [];
      for (const a of alerts) {
        const k = `${a.product_id}:${a.alert_type}`;
        if (!seenKeys.current.has(k)) {
          newOnes.push({
            toastId: `${a.id}-${
              typeof crypto !== "undefined" && crypto.randomUUID
                ? crypto.randomUUID()
                : Math.random().toString(36).slice(2)
            }`,
            message: a.message,
            alert_type: a.alert_type,
          });
        }
      }
      seenKeys.current = nextKeys;

      if (newOnes.length === 0) return;

      setToasts((prev) => [...prev, ...newOnes].slice(-16));
      for (const t of newOnes) {
        const id = t.toastId;
        window.setTimeout(() => {
          setToasts((prev) => prev.filter((x) => x.toastId !== id));
        }, 6500);
      }
    };

    return () => {
      es.close();
    };
  }, []);

  return (
    <div
      className="pointer-events-none fixed right-4 top-4 z-[100] flex max-w-sm flex-col gap-2 sm:right-6 sm:top-6"
      aria-live="polite"
    >
      {toasts.map((t) => (
        <div
          key={t.toastId}
          role="status"
          className="pointer-events-auto rounded-xl border border-emerald-500/35 bg-[#0c1210]/95 px-4 py-3 shadow-lg shadow-black/40 backdrop-blur"
        >
          <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-emerald-400/90">
            New alert · {t.alert_type.replace("_", " ")}
          </p>
          <p className="mt-1 text-sm text-zinc-100">{t.message}</p>
          <Link
            href="/alerts"
            className="mt-2 inline-block text-xs font-medium text-emerald-400/90 hover:text-emerald-300"
          >
            View alerts →
          </Link>
        </div>
      ))}
    </div>
  );
}
