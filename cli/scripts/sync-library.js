import { cpSync, rmSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const src = resolve(__dirname, "../../library");
const dest = resolve(__dirname, "../data");

if (!existsSync(src)) {
  console.error("Error: library/ directory not found at", src);
  process.exit(1);
}

// Clean previous copy
if (existsSync(dest)) {
  rmSync(dest, { recursive: true });
}

cpSync(src, dest, { recursive: true });
console.log("Synced library/ → cli/data/");
