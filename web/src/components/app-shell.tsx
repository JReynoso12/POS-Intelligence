import Link from "next/link";

const links = [
  { href: "/", label: "Dashboard" },
  { href: "/inventory", label: "Inventory" },
  { href: "/alerts", label: "Alerts" },
  { href: "/import", label: "CSV import" },
  { href: "/reports", label: "Daily report" },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#070a09] text-zinc-100">
      <div className="border-b border-white/10 bg-[#070a09]/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-emerald-400/90">
              POS Intelligence
            </p>
            <h1 className="text-lg font-semibold tracking-tight text-white">
              Owner view — 10 second clarity
            </h1>
          </div>
          <nav className="flex flex-wrap gap-2">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-zinc-200 transition hover:border-emerald-500/40 hover:bg-emerald-500/10 hover:text-white"
              >
                {l.label}
              </Link>
            ))}
          </nav>
        </div>
      </div>
      <main className="mx-auto max-w-7xl px-4 py-8">{children}</main>
    </div>
  );
}
