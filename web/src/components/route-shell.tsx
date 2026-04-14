"use client";

import { usePathname } from "next/navigation";
import { AppRoleProvider } from "@/components/app-role-context";
import { AppShell } from "@/components/app-shell";

const AUTH_PREFIXES = ["/login", "/register"];

function isAuthRoute(pathname: string | null) {
  if (!pathname) return false;
  return AUTH_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}

export function RouteShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  if (isAuthRoute(pathname)) {
    return (
      <div className="min-h-screen bg-[#070a09] text-zinc-100 antialiased">
        {children}
      </div>
    );
  }

  return (
    <AppRoleProvider>
      <AppShell>{children}</AppShell>
    </AppRoleProvider>
  );
}
