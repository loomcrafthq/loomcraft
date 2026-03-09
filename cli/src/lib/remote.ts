import YAML from "yaml";
import { fetchWithTimeout } from "./security.js";
import type { Preset } from "./library.js";

// ---------------------------------------------------------------------------
// Remote ref helpers
// ---------------------------------------------------------------------------

/**
 * A remote ref follows the pattern: org/repo/name
 * e.g., "loomcrafthq/presets/saas" or "myorg/agents/custom-db"
 */
export function isRemoteRef(ref: string): boolean {
  const parts = ref.split("/");
  return parts.length >= 3 && parts.every((p) => p.length > 0);
}

function parseRef(ref: string): { org: string; repo: string; name: string } {
  const parts = ref.split("/");
  if (parts.length < 3) {
    throw new Error(`Invalid remote ref "${ref}". Expected format: org/repo/name`);
  }
  return {
    org: parts[0],
    repo: parts[1],
    name: parts.slice(2).join("/"),
  };
}

function rawGitHubUrl(org: string, repo: string, filePath: string): string {
  return `https://raw.githubusercontent.com/${org}/${repo}/main/${filePath}`;
}

// ---------------------------------------------------------------------------
// Fetch remote agent
// ---------------------------------------------------------------------------

export async function fetchRemoteAgent(
  ref: string
): Promise<{ slug: string; rawContent: string }> {
  const { org, repo, name } = parseRef(ref);
  const url = rawGitHubUrl(org, repo, `agents/${name}/AGENT.md`);

  const res = await fetchWithTimeout(url);
  if (!res.ok) {
    throw new Error(`Agent "${ref}" not found (${res.status})`);
  }

  const rawContent = await res.text();
  return { slug: name, rawContent };
}

// ---------------------------------------------------------------------------
// Fetch remote preset
// ---------------------------------------------------------------------------

export async function fetchRemotePreset(ref: string): Promise<Preset> {
  const { org, repo, name } = parseRef(ref);
  const url = rawGitHubUrl(org, repo, `presets/${name}.yaml`);

  const res = await fetchWithTimeout(url);
  if (!res.ok) {
    throw new Error(`Preset "${ref}" not found (${res.status})`);
  }

  const raw = await res.text();
  const data = YAML.parse(raw) as Preset;
  return { ...data, slug: name };
}
