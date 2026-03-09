import YAML from "yaml";
import matter from "gray-matter";
import { fetchWithTimeout } from "./security.js";
import type {
  Preset,
  AgentInfo,
  AgentIndexEntry,
  PresetIndexEntry,
} from "./types.js";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_AGENTS_REPO = "loomcrafthq/agents";
const DEFAULT_PRESETS_REPO = "loomcrafthq/presets";

// ---------------------------------------------------------------------------
// Ref helpers
// ---------------------------------------------------------------------------

export function isRef(value: string): boolean {
  return value.includes("/");
}

/** Extract slug (last segment) from a ref like "org/repo/name" */
export function slugFromRef(ref: string): string {
  const parts = ref.split("/");
  return parts[parts.length - 1];
}

/** Parse ref into org, repo, name */
function parseRef(ref: string): { org: string; repo: string; name: string } {
  const parts = ref.split("/");
  if (parts.length < 3) {
    throw new Error(`Invalid ref "${ref}". Expected format: org/repo/name`);
  }
  return {
    org: parts[0],
    repo: parts[1],
    name: parts.slice(2).join("/"),
  };
}

function rawUrl(org: string, repo: string, filePath: string): string {
  return `https://raw.githubusercontent.com/${org}/${repo}/main/${filePath}`;
}

// ---------------------------------------------------------------------------
// Detect type by file convention
// ---------------------------------------------------------------------------

export type RefType = "agent" | "preset";

/**
 * Detect if a ref points to an agent (AGENT.md) or a preset (preset.yaml).
 * Tries AGENT.md first, then preset.yaml.
 */
export async function detectRefType(
  ref: string,
  hint?: RefType
): Promise<{ type: RefType; ref: string }> {
  const { org, repo, name } = parseRef(ref);

  if (hint === "agent") {
    const url = rawUrl(org, repo, `${name}/AGENT.md`);
    const res = await fetchWithTimeout(url, undefined, 10_000);
    if (res.ok) return { type: "agent", ref };
    throw new Error(`Agent "${ref}" not found (${name}/AGENT.md)`);
  }

  if (hint === "preset") {
    const url = rawUrl(org, repo, `${name}/preset.yaml`);
    const res = await fetchWithTimeout(url, undefined, 10_000);
    if (res.ok) return { type: "preset", ref };
    throw new Error(`Preset "${ref}" not found (${name}/preset.yaml)`);
  }

  // Auto-detect: try AGENT.md first, then preset.yaml
  const agentUrl = rawUrl(org, repo, `${name}/AGENT.md`);
  const agentRes = await fetchWithTimeout(agentUrl, undefined, 10_000);
  if (agentRes.ok) return { type: "agent", ref };

  const presetUrl = rawUrl(org, repo, `${name}/preset.yaml`);
  const presetRes = await fetchWithTimeout(presetUrl, undefined, 10_000);
  if (presetRes.ok) return { type: "preset", ref };

  throw new Error(
    `"${ref}" not found. Expected ${name}/AGENT.md or ${name}/preset.yaml in ${org}/${repo}.`
  );
}

// ---------------------------------------------------------------------------
// Fetch agent
// ---------------------------------------------------------------------------

export async function fetchAgent(
  ref: string
): Promise<{ slug: string; rawContent: string; info: AgentInfo }> {
  const { org, repo, name } = parseRef(ref);
  const url = rawUrl(org, repo, `${name}/AGENT.md`);

  const res = await fetchWithTimeout(url);
  if (!res.ok) {
    throw new Error(`Agent "${ref}" not found (${res.status})`);
  }

  const rawContent = await res.text();
  const { data } = matter(rawContent);
  const fm = data as Record<string, unknown>;

  return {
    slug: name,
    rawContent,
    info: {
      slug: name,
      name: (fm.name as string) || name,
      description: (fm.description as string) || "",
    },
  };
}

// ---------------------------------------------------------------------------
// Fetch preset
// ---------------------------------------------------------------------------

export async function fetchPreset(ref: string): Promise<Preset> {
  const { org, repo, name } = parseRef(ref);
  const url = rawUrl(org, repo, `${name}/preset.yaml`);

  const res = await fetchWithTimeout(url);
  if (!res.ok) {
    throw new Error(`Preset "${ref}" not found (${res.status})`);
  }

  const raw = await res.text();
  const data = YAML.parse(raw) as Omit<Preset, "slug">;
  return { ...data, slug: name };
}

// ---------------------------------------------------------------------------
// Fetch index (for interactive mode)
// ---------------------------------------------------------------------------

export async function fetchAgentIndex(
  repo = DEFAULT_AGENTS_REPO
): Promise<AgentIndexEntry[]> {
  const [org, repoName] = repo.split("/");
  const url = rawUrl(org, repoName, "agents.json");

  const res = await fetchWithTimeout(url);
  if (!res.ok) return [];

  return (await res.json()) as AgentIndexEntry[];
}

export async function fetchPresetIndex(
  repo = DEFAULT_PRESETS_REPO
): Promise<PresetIndexEntry[]> {
  const [org, repoName] = repo.split("/");
  const url = rawUrl(org, repoName, "presets.json");

  const res = await fetchWithTimeout(url);
  if (!res.ok) return [];

  return (await res.json()) as PresetIndexEntry[];
}

/** Build full ref from a default repo + slug */
export function agentRef(slug: string, repo = DEFAULT_AGENTS_REPO): string {
  return `${repo}/${slug}`;
}

export function presetRef(slug: string, repo = DEFAULT_PRESETS_REPO): string {
  return `${repo}/${slug}`;
}
