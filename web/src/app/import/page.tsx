"use client";

import { useState } from "react";

const example = `date,sku,quantity,unit_price
2026-04-13,MLK-1L,2,1.4
2026-04-13,RICE-25,1,32.5`;

export default function ImportPage() {
  const [text, setText] = useState("");
  const [result, setResult] = useState<string | null>(null);

  async function submit() {
    setResult(null);
    const r = await fetch("/api/import/csv", {
      method: "POST",
      body: text,
      headers: { "Content-Type": "text/csv" },
    });
    const j = await r.json();
    if (!r.ok) {
      setResult(JSON.stringify(j, null, 2));
      return;
    }
    setResult(
      `Imported ${j.imported} rows. ${j.errors?.length ? `Errors: ${j.errors.join("; ")}` : ""}`,
    );
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-white">CSV import (POS)</h2>
        <p className="text-sm text-zinc-500">
          MVP path: export daily sales from your POS as CSV and paste here.
          Columns: <code className="text-emerald-300">date</code>,{" "}
          <code className="text-emerald-300">sku</code> or{" "}
          <code className="text-emerald-300">product_name</code>,{" "}
          <code className="text-emerald-300">quantity</code>,{" "}
          <code className="text-emerald-300">unit_price</code>.
        </p>
      </div>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={12}
        placeholder="Paste CSV with header row…"
        className="w-full rounded-2xl border border-white/10 bg-black/30 p-4 font-mono text-sm text-zinc-100 placeholder:text-zinc-600"
      />

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => setText(example)}
          className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm text-zinc-200 hover:bg-white/10"
        >
          Load example
        </button>
        <button
          type="button"
          onClick={submit}
          className="rounded-full bg-emerald-500/90 px-5 py-2 text-sm font-medium text-emerald-950 hover:bg-emerald-400"
        >
          Import rows
        </button>
      </div>

      {result && (
        <pre className="whitespace-pre-wrap rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-zinc-300">
          {result}
        </pre>
      )}
    </div>
  );
}
