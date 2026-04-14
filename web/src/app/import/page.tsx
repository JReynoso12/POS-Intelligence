"use client";

import Papa from "papaparse";
import { useMemo, useState } from "react";

const example = `date,sku,quantity,unit_price
2026-04-13,MLK-1L,2,1.4
2026-04-13,RICE-25,1,32.5`;

export default function ImportPage() {
  const [text, setText] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const preview = useMemo(() => {
    const t = text.trim();
    if (!t) return { rows: [] as Record<string, string>[], errors: [] as string[] };
    const parsed = Papa.parse<Record<string, string>>(t, {
      header: true,
      skipEmptyLines: true,
    });
    const parseErrors = parsed.errors.map((e) => e.message ?? "Parse error");
    return {
      rows: (parsed.data ?? []).slice(0, 12),
      errors: parseErrors,
    };
  }, [text]);

  const headers = useMemo(() => {
    return preview.rows[0] ? Object.keys(preview.rows[0]) : [];
  }, [preview.rows]);

  async function submit() {
    setResult(null);
    setBusy(true);
    try {
      const r = await fetch("/api/import/csv", {
        method: "POST",
        body: text,
        headers: { "Content-Type": "text/csv" },
      });
      const j = (await r.json()) as {
        imported?: number;
        errors?: string[];
        error?: string;
      };
      if (!r.ok) {
        setResult(JSON.stringify(j, null, 2));
        return;
      }
      const errLines = j.errors?.length
        ? `\n\nRow issues:\n${j.errors.slice(0, 20).join("\n")}${j.errors.length > 20 ? `\n…${j.errors.length - 20} more` : ""}`
        : "";
      setResult(
        `Imported ${j.imported ?? 0} row(s).${errLines}`,
      );
    } finally {
      setBusy(false);
    }
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      const s = typeof reader.result === "string" ? reader.result : "";
      setText(s);
    };
    reader.readAsText(f);
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-white">CSV import (POS)</h2>
        <p className="text-sm text-zinc-500">
          Paste CSV or choose a <code className="text-emerald-300">.csv</code>{" "}
          file. Columns:{" "}
          <code className="text-emerald-300">date</code>,{" "}
          <code className="text-emerald-300">sku</code> or{" "}
          <code className="text-emerald-300">product_name</code>,{" "}
          <code className="text-emerald-300">quantity</code>,{" "}
          <code className="text-emerald-300">unit_price</code>.
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <label className="inline-flex cursor-pointer items-center rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm text-zinc-200 hover:bg-white/10">
          <input
            type="file"
            accept=".csv,text/csv,text/plain"
            className="sr-only"
            onChange={onFile}
          />
          Browse file
        </label>
      </div>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={12}
        placeholder="Paste CSV with header row…"
        className="w-full rounded-2xl border border-white/10 bg-black/30 p-4 font-mono text-sm text-zinc-100 placeholder:text-zinc-600"
      />

      {preview.errors.length > 0 && (
        <p className="text-sm text-amber-200">
          Parse warning: {preview.errors[0]}
        </p>
      )}

      {preview.rows.length > 0 && (
        <div className="overflow-x-auto rounded-2xl border border-white/10">
          <p className="bg-white/5 px-3 py-2 text-xs font-medium uppercase tracking-wide text-zinc-400">
            Preview (first {preview.rows.length} rows)
          </p>
          <table className="w-full text-left text-sm">
            <thead className="border-b border-white/10 bg-black/30 text-xs text-zinc-400">
              <tr>
                {headers.map((h) => (
                  <th key={h} className="px-3 py-2 font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {preview.rows.map((row, i) => (
                <tr key={i}>
                  {headers.map((h) => (
                    <td key={h} className="px-3 py-2 text-zinc-300">
                      {row[h] ?? ""}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

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
          disabled={busy || !text.trim()}
          onClick={() => void submit()}
          className="rounded-full bg-emerald-500/90 px-5 py-2 text-sm font-medium text-emerald-950 hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy ? "Importing…" : "Import rows"}
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
