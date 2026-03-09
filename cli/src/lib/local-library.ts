import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const LIBRARY_DIR = path.join(os.homedir(), ".loomcraft", "library");

function ensureDir(dir: string): void {
  fs.mkdirSync(dir, { recursive: true });
}

// ---------------------------------------------------------------------------
// Write (used by marketplace install)
// ---------------------------------------------------------------------------

export function saveLocalAgent(slug: string, content: string): string {
  const dir = path.join(LIBRARY_DIR, "agents", slug);
  ensureDir(dir);
  const filePath = path.join(dir, "AGENT.md");
  fs.writeFileSync(filePath, content, "utf-8");
  return filePath;
}

export function saveLocalPreset(slug: string, content: string): string {
  const dir = path.join(LIBRARY_DIR, "presets");
  ensureDir(dir);
  const filePath = path.join(dir, `${slug}.yaml`);
  fs.writeFileSync(filePath, content, "utf-8");
  return filePath;
}

// ---------------------------------------------------------------------------
// Meta (version tracking for marketplace installs)
// ---------------------------------------------------------------------------

export interface LocalMeta {
  sourceSlug: string;
  version: number;
  contentHash: string | null;
}

export function saveLocalMeta(
  type: "agent" | "preset",
  slug: string,
  meta: LocalMeta
): void {
  let dir: string;
  if (type === "preset") {
    dir = path.join(LIBRARY_DIR, "presets");
  } else {
    dir = path.join(LIBRARY_DIR, "agents", slug);
  }
  ensureDir(dir);
  const fileName = type === "preset" ? `${slug}.meta.json` : ".meta.json";
  fs.writeFileSync(path.join(dir, fileName), JSON.stringify(meta, null, 2), "utf-8");
}

export function getLocalMeta(
  type: "agent" | "preset",
  slug: string
): LocalMeta | null {
  let filePath: string;
  if (type === "preset") {
    filePath = path.join(LIBRARY_DIR, "presets", `${slug}.meta.json`);
  } else {
    filePath = path.join(LIBRARY_DIR, "agents", slug, ".meta.json");
  }
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(raw) as LocalMeta;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Read (used by add command fallback)
// ---------------------------------------------------------------------------

export function getLocalAgent(
  slug: string
): { slug: string; rawContent: string } | null {
  const filePath = path.join(LIBRARY_DIR, "agents", slug, "AGENT.md");
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    return { slug, rawContent: raw };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// List (used by list command)
// ---------------------------------------------------------------------------

export interface LocalItem {
  slug: string;
  type: "agent" | "preset";
}

function listSubDirs(dir: string): string[] {
  try {
    return fs
      .readdirSync(dir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
      .sort();
  } catch {
    return [];
  }
}

export function listLocalResources(): LocalItem[] {
  const items: LocalItem[] = [];

  for (const slug of listSubDirs(path.join(LIBRARY_DIR, "agents"))) {
    items.push({ slug, type: "agent" });
  }

  try {
    const presetsDir = path.join(LIBRARY_DIR, "presets");
    const files = fs.readdirSync(presetsDir).filter((f) => f.endsWith(".yaml"));
    for (const f of files) {
      items.push({ slug: f.replace(/\.yaml$/, ""), type: "preset" });
    }
  } catch {
    // No presets dir
  }

  return items;
}
