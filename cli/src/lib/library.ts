import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import matter from "gray-matter";
import YAML from "yaml";
import { isRemoteRef, fetchRemoteAgent, fetchRemotePreset } from "./remote.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, "../data");

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AgentSummary {
  slug: string;
  name: string;
  description: string;
}

export interface WorkflowStep {
  agent: string;
  condition?: string;
  mode?: "tdd" | "test-after";
  scope?: string;
}

export interface Workflow {
  preparation: {
    source: "linear" | "github-issues" | "manual";
  };
  pipeline: WorkflowStep[];
  verification: string[];
  finalization: {
    commits: "conventional" | "custom";
    branch: string;
  };
}

export interface Preset {
  slug: string;
  name: string;
  description: string;
  agents: string[];
  skills: string[]; // external refs: "loomcraft/skills/brainstorm"
  workflow: Workflow;
}

interface PresetSummary {
  slug: string;
  name: string;
  description: string;
  agentCount: number;
  skillCount: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function listSubDirs(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();
}

function listFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isFile())
    .map((d) => d.name)
    .sort();
}

// ---------------------------------------------------------------------------
// Public API — Agents
// ---------------------------------------------------------------------------

export async function listAgents(): Promise<AgentSummary[]> {
  const agentsDir = path.join(DATA_DIR, "agents");
  const slugs = listSubDirs(agentsDir);
  const agents: AgentSummary[] = [];

  for (const slug of slugs) {
    const filePath = path.join(agentsDir, slug, "AGENT.md");
    try {
      const raw = fs.readFileSync(filePath, "utf-8");
      const { data } = matter(raw);
      const fm = data as Record<string, unknown>;
      agents.push({
        slug,
        name: (fm.name as string) || slug,
        description: (fm.description as string) || "",
      });
    } catch {
      agents.push({ slug, name: slug, description: "" });
    }
  }
  return agents;
}

export async function getAgent(
  slugOrRef: string
): Promise<{ slug: string; rawContent: string }> {
  // Remote ref (org/repo/name) → fetch from GitHub
  if (isRemoteRef(slugOrRef)) {
    return fetchRemoteAgent(slugOrRef);
  }

  // Bundled agent
  const filePath = path.join(DATA_DIR, "agents", slugOrRef, "AGENT.md");
  const raw = fs.readFileSync(filePath, "utf-8");
  return { slug: slugOrRef, rawContent: raw };
}

// ---------------------------------------------------------------------------
// Public API — Presets
// ---------------------------------------------------------------------------

export async function listPresets(): Promise<PresetSummary[]> {
  const presetsDir = path.join(DATA_DIR, "presets");
  const files = listFiles(presetsDir);
  const presets: PresetSummary[] = [];

  for (const file of files) {
    if (!file.endsWith(".yaml")) continue;
    const slug = file.replace(/\.yaml$/, "");
    try {
      const raw = fs.readFileSync(path.join(presetsDir, file), "utf-8");
      const data = YAML.parse(raw) as Preset;
      presets.push({
        slug,
        name: data.name || slug,
        description: data.description || "",
        agentCount: data.agents?.length || 0,
        skillCount: data.skills?.length || 0,
      });
    } catch {
      presets.push({ slug, name: slug, description: "", agentCount: 0, skillCount: 0 });
    }
  }
  return presets;
}

export async function getPreset(slugOrRef: string): Promise<Preset> {
  // Remote ref (org/repo/name) → fetch from GitHub
  if (isRemoteRef(slugOrRef)) {
    return fetchRemotePreset(slugOrRef);
  }

  // Bundled preset
  const filePath = path.join(DATA_DIR, "presets", `${slugOrRef}.yaml`);
  const raw = fs.readFileSync(filePath, "utf-8");
  const data = YAML.parse(raw) as Preset;
  return { ...data, slug: slugOrRef };
}
