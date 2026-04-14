import Link from "next/link";
import { Suspense } from "react";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <div className="relative min-h-screen overflow-hidden">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(16,185,129,0.12),transparent)]"
        aria-hidden
      />
      <div className="relative flex min-h-screen flex-col items-center justify-center px-4 py-12">
        <div className="w-full max-w-[420px] space-y-8">
          <header className="text-center">
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-emerald-400/90">
              POS Intelligence
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white">
              Sign in
            </h1>
            <p className="mt-2 text-sm text-zinc-500">
              Enter your email and password to open the owner view.
            </p>
          </header>

          <div className="rounded-2xl border border-white/10 bg-[#0a0f0d]/90 p-6 shadow-xl shadow-black/40 backdrop-blur sm:p-8">
            <Suspense
              fallback={
                <div className="py-8 text-center text-sm text-zinc-500">
                  Loading…
                </div>
              }
            >
              <LoginForm />
            </Suspense>
          </div>

          <p className="text-center text-sm text-zinc-500">
            Need an account?{" "}
            <Link
              href="/register"
              className="font-medium text-emerald-400/90 underline-offset-2 hover:text-emerald-300 hover:underline"
            >
              Register here
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
