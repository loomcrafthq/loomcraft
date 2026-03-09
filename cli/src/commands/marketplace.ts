import pc from "picocolors";
import { fetchWithTimeout } from "../lib/security.js";

const DEFAULT_API_URL = "https://loomcraft.dev";

interface MarketplaceItem {
  id: string;
  type: string;
  slug: string;
  title: string;
  description: string;
  authorName: string | null;
  repoRef: string | null;
  installCount: number;
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

export async function marketplaceSearchCommand(
  query?: string,
  opts?: { type?: string; sort?: string }
): Promise<void> {
  try {
    const url = new URL("/api/cli/marketplace", getApiUrl());
    if (query) url.searchParams.set("q", query);
    if (opts?.type) url.searchParams.set("type", opts.type);
    if (opts?.sort) url.searchParams.set("sort", opts.sort);

    const res = await fetchWithTimeout(url.toString());
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data = (await res.json()) as { items: MarketplaceItem[] };

    if (data.items.length === 0) {
      console.log(pc.dim("\n  No results found.\n"));
      return;
    }

    console.log(
      pc.bold(pc.cyan(`\n  Marketplace${query ? ` — "${query}"` : ""}`))
    );
    console.log(pc.dim("  " + "─".repeat(70)));

    for (const item of data.items) {
      const type = pc.dim(`[${item.type}]`);
      const installs = pc.dim(`↓${item.installCount}`);
      const author = item.authorName ? pc.dim(`by ${item.authorName}`) : "";
      console.log(
        `  ${padEnd(pc.green(item.slug), 25)} ${padEnd(type, 14)} ${padEnd(truncate(item.title, 25), 27)} ${installs} ${author}`
      );
    }

    console.log(
      pc.dim(
        `\n  Use a preset: ${pc.reset("loomcraft init org/repo/preset-name")}`
      )
    );
    console.log(
      pc.dim(
        `  Add an agent: ${pc.reset("loomcraft add agent org/repo/agent-name")}\n`
      )
    );
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      console.error(pc.red("\n  ✗ Request timed out. Check your connection.\n"));
    } else if (error instanceof Error) {
      console.error(pc.red(`\n  ✗ ${error.message}\n`));
    } else {
      console.error(pc.red("\n  ✗ Could not reach the marketplace.\n"));
    }
    process.exit(1);
  }
}
