import pc from "picocolors";
import {
  saveLocalAgent,
  saveLocalPreset,
  saveLocalMeta,
  getLocalMeta,
  listLocalResources,
} from "../lib/local-library.js";
import { validateSlug, fetchWithTimeout, verifyContentHash } from "../lib/security.js";

const DEFAULT_API_URL = "https://loomcraft.dev";

interface MarketplaceItem {
  id: string;
  type: string;
  slug: string;
  title: string;
  description: string;
  authorName: string | null;
  installCount: number;
}

interface InstallResponse {
  resource: {
    id: string;
    type: string;
    slug: string;
    title: string;
    content: string;
    version: number;
    contentHash: string | null;
  };
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
        `\n  Install with: ${pc.reset("loomcraft marketplace install <slug>")}\n`
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

export async function marketplaceInstallCommand(
  slug: string
): Promise<void> {
  try {
    validateSlug(slug);

    const url = new URL("/api/cli/marketplace/install", getApiUrl());

    const res = await fetchWithTimeout(url.toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug }),
    });

    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(body.error ?? `HTTP ${res.status}`);
    }

    const data = (await res.json()) as InstallResponse;
    const r = data.resource;

    // Verify content integrity
    const hashValid = await verifyContentHash(r.content, r.contentHash);
    if (!hashValid) {
      throw new Error("Content integrity check failed — hash mismatch");
    }

    // Save to ~/.loomcraft/library/
    if (r.type === "agent") {
      saveLocalAgent(r.slug, r.content);
    } else if (r.type === "preset") {
      saveLocalPreset(r.slug, r.content);
    }

    // Save version metadata
    const metaType = r.type === "preset" ? "preset" : "agent";
    saveLocalMeta(metaType as "agent" | "preset", r.slug, {
      sourceSlug: r.slug,
      version: r.version,
      contentHash: r.contentHash,
    });

    console.log(
      pc.green(`\n  ✓ Installed "${r.title}" (${r.type}) v${r.version} to ~/.loomcraft/library/\n`)
    );
    if (r.type === "agent") {
      console.log(
        pc.dim(`  Use it: loomcraft add agent ${r.slug}\n`)
      );
    }
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      console.error(pc.red("\n  ✗ Request timed out. Check your connection.\n"));
    } else if (error instanceof Error) {
      console.error(pc.red(`\n  ✗ ${error.message}\n`));
    } else {
      console.error(pc.red("\n  ✗ Installation failed.\n"));
    }
    process.exit(1);
  }
}

interface CheckUpdateResponse {
  slug: string;
  version: number;
  contentHash: string | null;
}

export async function marketplaceUpdateCommand(
  slug?: string
): Promise<void> {
  try {
    if (slug) validateSlug(slug);

    const apiUrl = getApiUrl();

    // Determine which resources to check
    const toCheck: { slug: string; type: "agent" | "preset" }[] = [];

    if (slug) {
      for (const type of ["agent", "preset"] as const) {
        const meta = getLocalMeta(type, slug);
        if (meta) {
          toCheck.push({ slug, type });
          break;
        }
      }
      if (toCheck.length === 0) {
        console.log(pc.yellow(`\n  No installed resource found with slug "${slug}"\n`));
        return;
      }
    } else {
      const items = listLocalResources();
      for (const item of items) {
        const meta = getLocalMeta(item.type, item.slug);
        if (meta) {
          toCheck.push({ slug: item.slug, type: item.type });
        }
      }
      if (toCheck.length === 0) {
        console.log(pc.dim("\n  No marketplace-installed resources found.\n"));
        return;
      }
    }

    let updatedCount = 0;

    for (const item of toCheck) {
      const meta = getLocalMeta(item.type, item.slug);
      if (!meta) continue;

      const checkUrl = new URL("/api/cli/marketplace/check-update", apiUrl);
      checkUrl.searchParams.set("slug", item.slug);

      const checkRes = await fetchWithTimeout(checkUrl.toString());
      if (!checkRes.ok) continue;

      const remote = (await checkRes.json()) as CheckUpdateResponse;

      if (remote.version <= meta.version) {
        console.log(
          pc.dim(`  ${item.slug} — up to date (v${meta.version})`)
        );
        continue;
      }

      console.log(
        pc.cyan(`  ${item.slug} — v${meta.version} → v${remote.version}`)
      );

      await marketplaceInstallCommand(item.slug);
      updatedCount++;
    }

    if (updatedCount === 0) {
      console.log(pc.green("\n  All resources are up to date.\n"));
    } else {
      console.log(
        pc.green(`\n  ✓ Updated ${updatedCount} resource${updatedCount > 1 ? "s" : ""}.\n`)
      );
    }
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      console.error(pc.red("\n  ✗ Request timed out. Check your connection.\n"));
    } else if (error instanceof Error) {
      console.error(pc.red(`\n  ✗ ${error.message}\n`));
    } else {
      console.error(pc.red("\n  ✗ Update check failed.\n"));
    }
    process.exit(1);
  }
}
