"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useId, useState } from "react";
import { AlertRealtime } from "@/components/alert-realtime";
import { createClient } from "@/lib/supabase/client";

const STORAGE_KEY = "pos-sidebar-collapsed";

const links = [
  {
    href: "/dashboard",
    label: "Dashboard",
    icon: IconDashboard,
  },
  {
    href: "/inventory",
    label: "Inventory",
    icon: IconInventory,
  },
  { href: "/alerts", label: "Alerts", icon: IconAlerts },
  { href: "/import", label: "CSV import", icon: IconImport },
  { href: "/reports", label: "Daily report", icon: IconReports },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const navId = useId();
  const [collapsed, setCollapsed] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [alertCount, setAlertCount] = useState(0);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(STORAGE_KEY) === "1") {
        setCollapsed(true);
      }
    } catch {
      /* ignore */
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, collapsed ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, [collapsed, hydrated]);

  async function logout() {
    setSigningOut(true);
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
    } catch {
      /* still leave app */
    }
    router.push("/login");
    router.refresh();
    setSigningOut(false);
  }

  return (
    <div className="relative flex min-h-screen bg-[#070a09] text-zinc-100">
      <AlertRealtime onUnresolvedCount={setAlertCount} />
      <aside
        className={`flex shrink-0 flex-col border-r border-white/10 bg-[#050807] transition-[width] duration-200 ease-out ${
          collapsed ? "w-[4.5rem]" : "w-56 sm:w-60"
        }`}
        aria-label="Main navigation"
      >
        <div
          className={`flex items-center gap-2 border-b border-white/10 ${
            collapsed ? "flex-col px-2 py-3" : "justify-between px-3 py-3"
          }`}
        >
          {!collapsed && (
            <div className="min-w-0">
              <p className="truncate text-[10px] font-medium uppercase tracking-[0.18em] text-emerald-400/90">
                POS Intelligence
              </p>
            </div>
          )}
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-zinc-300 transition hover:border-emerald-500/40 hover:bg-emerald-500/10 hover:text-white"
            aria-expanded={!collapsed}
            aria-controls={navId}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? (
              <IconPanelOpen className="h-5 w-5" />
            ) : (
              <IconPanelClose className="h-5 w-5" />
            )}
          </button>
        </div>

        <nav id={navId} className="flex flex-1 flex-col gap-0.5 overflow-x-visible p-2">
          {links.map((l) => {
            const active =
              pathname === l.href ||
              (l.href !== "/dashboard" && pathname?.startsWith(l.href));
            const Icon = l.icon;
            const isAlerts = l.href === "/alerts";
            const showBadge = isAlerts && alertCount > 0;

            if (isAlerts) {
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  title={collapsed ? l.label : undefined}
                  className={`flex items-center gap-2 rounded-lg border text-sm transition ${
                    collapsed ? "justify-center px-2 py-2.5" : "justify-between px-3 py-2.5"
                  } ${
                    active
                      ? "border-emerald-500/35 bg-emerald-500/10 text-white"
                      : "border-transparent text-zinc-300 hover:border-white/10 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  <span className="relative inline-flex shrink-0">
                    <Icon
                      className={`h-5 w-5 ${active ? "text-emerald-400" : "text-zinc-500"}`}
                    />
                    {collapsed && showBadge && (
                      <span className="absolute -right-1 -top-1 z-10 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-0.5 text-[9px] font-bold leading-none text-white ring-2 ring-[#050807]">
                        {alertCount > 9 ? "9+" : alertCount}
                      </span>
                    )}
                  </span>
                  {!collapsed && (
                    <>
                      <span className="min-w-0 flex-1 truncate text-left">
                        {l.label}
                      </span>
                      {showBadge && (
                        <span className="z-10 flex h-5 min-w-[1.25rem] shrink-0 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white ring-2 ring-[#050807]">
                          {alertCount > 99 ? "99+" : alertCount}
                        </span>
                      )}
                    </>
                  )}
                  {collapsed && (
                    <span className="sr-only">{l.label}</span>
                  )}
                </Link>
              );
            }

            return (
              <Link
                key={l.href}
                href={l.href}
                title={collapsed ? l.label : undefined}
                className={`flex items-center gap-3 rounded-lg border text-sm transition ${
                  collapsed ? "justify-center px-2 py-2.5" : "px-3 py-2.5"
                } ${
                  active
                    ? "border-emerald-500/35 bg-emerald-500/10 text-white"
                    : "border-transparent text-zinc-300 hover:border-white/10 hover:bg-white/5 hover:text-white"
                }`}
              >
                <Icon
                  className={`h-5 w-5 shrink-0 ${active ? "text-emerald-400" : "text-zinc-500"}`}
                />
                {!collapsed && <span className="truncate">{l.label}</span>}
                {collapsed && (
                  <span className="sr-only">{l.label}</span>
                )}
              </Link>
            );
          })}
        </nav>

        <div
          className={`mt-auto border-t border-white/10 p-2 ${
            collapsed ? "flex justify-center" : ""
          }`}
        >
          <button
            type="button"
            onClick={() => void logout()}
            disabled={signingOut}
            title={collapsed ? "Log out" : undefined}
            className={`flex w-full items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-zinc-200 transition hover:border-rose-500/40 hover:bg-rose-500/10 hover:text-white disabled:opacity-50 ${
              collapsed ? "justify-center px-2" : ""
            }`}
          >
            <IconLogout className="h-5 w-5 shrink-0 text-zinc-400" />
            {!collapsed && (
              <span className="truncate">{signingOut ? "Signing out…" : "Log out"}</span>
            )}
            {collapsed && (
              <span className="sr-only">Log out</span>
            )}
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="border-b border-white/10 bg-[#070a09]/80 px-4 py-4 backdrop-blur">
          <h1 className="text-lg font-semibold tracking-tight text-white">
            Owner view — 10 second clarity
          </h1>
        </header>
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8">
          {children}
        </main>
      </div>
    </div>
  );
}

function IconPanelClose({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M15 18l-6-6 6-6" />
    </svg>
  );
}

function IconPanelOpen({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M9 18l6-6-6-6" />
    </svg>
  );
}

function IconDashboard({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <path d="M9 22V12h6v10" />
    </svg>
  );
}

function IconInventory({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      <path d="M3.27 6.96L12 12.01l8.73-5.05" />
      <path d="M12 22.08V12" />
    </svg>
  );
}

function IconAlerts({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}

function IconImport({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  );
}

function IconReports({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
      <path d="M16 13H8" />
      <path d="M16 17H8" />
      <path d="M10 9H8" />
    </svg>
  );
}

function IconLogout({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}
