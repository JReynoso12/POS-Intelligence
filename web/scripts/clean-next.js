/**
 * Removes `.next` so the next `next dev` / `next build` starts from a clean cache.
 * If this fails with EBUSY / EPERM, stop `npm run dev` (Ctrl+C) and run again.
 */
const fs = require("fs");
const path = require("path");

const dir = path.join(process.cwd(), ".next");
if (!fs.existsSync(dir)) {
  console.log("No .next folder — nothing to clean.");
  process.exit(0);
}
try {
  fs.rmSync(dir, { recursive: true, force: true });
  console.log("Removed .next");
} catch (e) {
  const err = /** @type {NodeJS.ErrnoException} */ (e);
  console.error(
    "\nCould not delete .next — is `npm run dev` still running? Stop it (Ctrl+C), then run: npm run clean\n",
  );
  console.error(err.code ?? err.message);
  process.exit(1);
}
