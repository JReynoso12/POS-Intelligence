import type { Metadata } from "next";
import { RouteShell } from "@/components/route-shell";
import "./globals.css";

export const metadata: Metadata = {
  title: "POS Intelligence",
  description: "Sales intelligence, inventory, and smart alerts for retail owners",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <RouteShell>{children}</RouteShell>
      </body>
    </html>
  );
}
