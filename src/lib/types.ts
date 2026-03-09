// ---------------------------------------------------------------------------
// Agent
// ---------------------------------------------------------------------------

export interface AgentInfo {
  slug: string;
  name: string;
  description: string;
}

// ---------------------------------------------------------------------------
// Preset
// ---------------------------------------------------------------------------

export interface PipelineStep {
  agent: string;
  when?: string;
  mode?: "tdd" | "test-after";
  scope?: string;
}

export interface Conventions {
  commits?: "conventional" | "custom";
  branches?: string;
}

export interface Preset {
  slug: string;
  name: string;
  description: string;
  agents: string[];          // refs: loomcrafthq/agents/database
  skills: string[];          // refs: obra/superpowers/brainstorming
  pipeline: PipelineStep[];
  verification: string[];
  conventions?: Conventions;
}

// ---------------------------------------------------------------------------
// Index (fetched from repo index.json)
// ---------------------------------------------------------------------------

export interface AgentIndexEntry {
  slug: string;
  name: string;
  description: string;
}

export interface PresetIndexEntry {
  slug: string;
  name: string;
  description: string;
  agents: number;
  skills: number;
}

// ---------------------------------------------------------------------------
// Config (loomcraft.config.json)
// ---------------------------------------------------------------------------

export interface LoomcraftConfig {
  target: string;
  targetDir: string;
  contextFile: string;
  preset?: string;
  agents: string[];     // installed agent refs
  skills: string[];     // installed skill refs
}
