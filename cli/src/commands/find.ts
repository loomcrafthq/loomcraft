import pc from "picocolors";
import { fetchWithTimeout } from "../lib/security.js";
import { trackFind } from "../lib/telemetry.js";

const DEFAULT_API_URL = "https://loomcraft.dev";

interface SearchItem {
  ref: string;
  name: string;
  type: string;
  installs: number;
}

function padEnd(str: string, len: number): string {
  return str + " ".repeat(Math.max(0, len - str.length));
}

function truncate(str: string, max: number): string {
  if (str.length <= max) return str;
  return str.slice(0, max - 1) + "…";
}

function getApiUrl(): string {
  const url = process.env.LOOMCRAFT_API_URL ?? process.env.LOOM_API_URL ?? DEFAULT_API_URL;
  if (!url.startsWith("https://") && !url.startsWith("http://localhost") && !url.startsWith("http://127.0.0.1")) {
    return DEFAULT_API_URL;
  }
  return url;
}

export async function findCommand(
  query?: string,
  opts?: { type?: string; sort?: string }
): Promise<void> {
  try {
    const url = new URL("/api/search", getApiUrl());
    if (query) url.searchParams.set("q", query);
    if (opts?.type) url.searchParams.set("type", opts.type);
    if (opts?.sort) url.searchParams.set("sort", opts.sort);
    url.searchParams.set("limit", "20");

    const res = await fetchWithTimeout(url.toString());
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data = (await res.json()) as { items: SearchItem[] };

    trackFind(query || "", data.items.length);

    if (data.items.length === 0) {
      console.log(pc.dim("\n  No results found.\n"));
      return;
    }

    console.log(
      pc.bold(pc.cyan(`\n  Results${query ? ` for "${query}"` : ""}`))
    );
    console.log(pc.dim("  " + "─".repeat(70)));

    for (const item of data.items) {
      const type = pc.dim(`[${item.type}]`);
      const installs = item.installs > 0 ? pc.dim(`↓${item.installs}`) : "";
      console.log(
        `  ${padEnd(pc.green(item.ref), 40)} ${padEnd(type, 12)} ${padEnd(truncate(item.name, 20), 22)} ${installs}`
      );
    }

    console.log(
      pc.dim(`\n  Use: ${pc.reset("loomcraft add <ref>")}\n`)
    );
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      console.error(pc.red("\n  ✗ Request timed out.\n"));
    } else if (error instanceof Error) {
      console.error(pc.red(`\n  ✗ ${error.message}\n`));
    } else {
      console.error(pc.red("\n  ✗ Could not reach the marketplace.\n"));
    }
    process.exit(1);
  }
}
