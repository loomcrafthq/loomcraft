import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import matter from "gray-matter";
import YAML from "yaml";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, "../data");

export interface AgentSummary {
  slug: string;
  name: string;
  description: string;
  role: string;
  skills: string[];
}

interface SkillSummary {
  slug: string;
  name: string;
  description: string;
}

interface PresetSummary {
  slug: string;
  name: string;
  description: string;
  agentCount: number;
  skillCount: number;
}

export interface Preset {
  slug: string;
  name: string;
  description: string;
  agents: string[];
  skills: string[];
  constitution: {
    principles: string[];
    conventions: string[];
    customSections?: Record<string, string>;
  };
  context: {
    projectDescription: string;
  };
}

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

export interface SkillFile {
  relativePath: string; // e.g. "SKILL.md", "examples/api.md"
  content: string;
}

const TEXT_EXTENSIONS = new Set([
  ".md", ".ts", ".js", ".sh", ".dot", ".yaml", ".yml", ".json", ".css", ".html",
]);

function walkDir(dir: string, base = ""): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const results: string[] = [];
  for (const entry of entries) {
    const rel = base ? `${base}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      results.push(...walkDir(path.join(dir, entry.name), rel));
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      if (TEXT_EXTENSIONS.has(ext)) {
        results.push(rel);
      }
    }
  }
  return results;
}

// --- Public API ---

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
        role: (fm.role as string) || "",
        skills: Array.isArray(fm.skills) ? (fm.skills as string[]) : [],
      });
    } catch {
      agents.push({ slug, name: slug, description: "", role: "", skills: [] });
    }
  }
  return agents;
}

export async function listSkills(): Promise<SkillSummary[]> {
  const skillsDir = path.join(DATA_DIR, "skills");
  const slugs = listSubDirs(skillsDir);
  const skills: SkillSummary[] = [];

  for (const slug of slugs) {
    const filePath = path.join(skillsDir, slug, "SKILL.md");
    try {
      const raw = fs.readFileSync(filePath, "utf-8");
      const { data } = matter(raw);
      skills.push({
        slug,
        name: (data as Record<string, string>).name || slug,
        description: (data as Record<string, string>).description || "",
      });
    } catch {
      skills.push({ slug, name: slug, description: "" });
    }
  }
  return skills;
}

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

export async function getAgent(
  slug: string
): Promise<{ slug: string; rawContent: string }> {
  const filePath = path.join(DATA_DIR, "agents", slug, "AGENT.md");
  const raw = fs.readFileSync(filePath, "utf-8");
  return { slug, rawContent: raw };
}

export async function getSkill(
  slug: string
): Promise<{ slug: string; rawContent: string }> {
  const filePath = path.join(DATA_DIR, "skills", slug, "SKILL.md");
  const raw = fs.readFileSync(filePath, "utf-8");
  return { slug, rawContent: raw };
}

export async function getSkillWithFiles(
  slug: string
): Promise<{ slug: string; mainContent: string; files: SkillFile[] }> {
  const skillDir = path.join(DATA_DIR, "skills", slug);
  const mainPath = path.join(skillDir, "SKILL.md");
  const mainContent = fs.readFileSync(mainPath, "utf-8");

  const relativePaths = walkDir(skillDir);
  const files: SkillFile[] = relativePaths.map((relativePath) => ({
    relativePath,
    content: fs.readFileSync(path.join(skillDir, relativePath), "utf-8"),
  }));

  return { slug, mainContent, files };
}

export async function getPreset(slug: string): Promise<Preset> {
  const filePath = path.join(DATA_DIR, "presets", `${slug}.yaml`);
  const raw = fs.readFileSync(filePath, "utf-8");
  const data = YAML.parse(raw) as Preset;
  return { ...data, slug };
}
