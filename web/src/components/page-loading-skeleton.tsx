/** Instant route-level placeholder while the page chunk hydrates. */

export function PageLoadingSkeleton({
  variant = "default",
}: {
  variant?: "dashboard" | "default" | "table";
}) {
  if (variant === "dashboard") {
    return (
      <div className="animate-pulse space-y-6" aria-hidden>
        <div className="h-4 w-64 rounded bg-white/10" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-28 rounded-2xl bg-white/5" />
          ))}
        </div>
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="h-80 rounded-2xl bg-white/5 lg:col-span-2" />
          <div className="h-80 rounded-2xl bg-white/5" />
        </div>
      </div>
    );
  }
  if (variant === "table") {
    return (
      <div className="animate-pulse space-y-4" aria-hidden>
        <div className="h-8 w-40 rounded-lg bg-white/10" />
        <div className="h-36 rounded-2xl bg-white/5" />
        <div className="h-72 rounded-2xl bg-white/5" />
      </div>
    );
  }
  return (
    <div className="animate-pulse space-y-4" aria-hidden>
      <div className="h-8 w-48 rounded-lg bg-white/10" />
      <div className="h-4 w-full max-w-xl rounded bg-white/5" />
      <div className="h-72 rounded-2xl bg-white/5" />
    </div>
  );
}
