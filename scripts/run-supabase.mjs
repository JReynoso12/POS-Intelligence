/**
 * Runs the Supabase CLI from the repo root (where supabase/config.toml lives).
 * Fixes "Cannot find project ref" when npm is invoked from a subdirectory (e.g. supabase/).
 */
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
process.chdir(root);

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error("Usage: node scripts/run-supabase.mjs <supabase-args...>");
  process.exit(1);
}

const isWin = process.platform === "win32";
const result = spawnSync(isWin ? "npx.cmd" : "npx", ["supabase", ...args], {
  cwd: root,
  stdio: "inherit",
  shell: true,
  env: process.env,
});

process.exit(result.status ?? 1);
