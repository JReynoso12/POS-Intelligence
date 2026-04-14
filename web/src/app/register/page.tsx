import Link from "next/link";
import { RegisterForm } from "./register-form";

export default function RegisterPage() {
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <aside className="relative hidden flex-col justify-center border-b border-white/10 bg-[#030605] px-10 py-14 lg:flex lg:border-b-0 lg:border-r lg:border-white/10">
        <div
          className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(16,185,129,0.08)_0%,transparent_55%)]"
          aria-hidden
        />
        <div className="relative max-w-md">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-emerald-400/90">
            POS Intelligence
          </p>
          <h2 className="mt-4 text-3xl font-semibold leading-tight tracking-tight text-white">
            Create your account
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-zinc-400">
            Registration is separate from sign-in — set up credentials here, then
            use the login page to access the dashboard.
          </p>
          <ul className="mt-10 space-y-4 text-sm text-zinc-300">
            <li className="flex gap-3">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500/80" />
              Email and password stored securely via Supabase Auth.
            </li>
            <li className="flex gap-3">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500/80" />
              Same app — registration and login use different screens by design.
            </li>
          </ul>
          <p className="mt-10 text-sm text-zinc-500">
            Already registered?{" "}
            <Link
              href="/login"
              className="font-medium text-emerald-400/90 underline-offset-2 hover:text-emerald-300 hover:underline"
            >
              Go to sign in
            </Link>
          </p>
        </div>
      </aside>

      <div className="flex flex-col justify-center px-4 py-14 sm:px-8 lg:py-12">
        <div className="mx-auto w-full max-w-[440px] space-y-8 lg:max-w-none lg:px-4">
          <header className="lg:hidden">
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-emerald-400/90">
              POS Intelligence
            </p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white">
              Create account
            </h1>
            <p className="mt-2 text-sm text-zinc-500">
              Email and password — you’ll sign in on the other page.
            </p>
          </header>

          <div className="rounded-2xl border border-emerald-500/20 bg-[#0a0f0d]/95 p-6 shadow-xl shadow-black/40 backdrop-blur sm:p-8 lg:border-white/10 lg:border-l-4 lg:border-l-emerald-500/50">
            <RegisterForm />
          </div>

          <p className="text-center text-sm text-zinc-500 lg:hidden">
            <Link
              href="/login"
              className="font-medium text-emerald-400/90 underline-offset-2 hover:text-emerald-300 hover:underline"
            >
              ← Back to sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
