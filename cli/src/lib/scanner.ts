import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import YAML from "yaml";
import { BUILTIN_TARGETS } from "./target.js";
import type { SkillFile } from "./library.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ScannedAgent {
  slug: string;
  name: string;
  description: string;
  role: string;
  skills: string[];
  content: string;
}

export interface ScannedSkill {
  slug: string;
  name: string;
  description: string;
  files: SkillFile[];
}

export interface SkippedItem {
  path: string;
  reason: string;
}

export interface ScanResult {
  target: "claude-code" | "cursor";
  projectName: string;
  agents: ScannedAgent[];
  skills: ScannedSkill[];
  skipped: SkippedItem[];
}

// ---------------------------------------------------------------------------
// Helpers (same patterns as local-library.ts)
// ---------------------------------------------------------------------------

const TEXT_EXTENSIONS = new Set([
  ".md", ".ts", ".js", ".sh", ".dot", ".yaml", ".yml", ".json", ".css", ".html",
]);

function walkDir(dir: string, base = ""): string[] {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }
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

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function detectTargets(dir: string): ("claude-code" | "cursor")[] {
  const targets: ("claude-code" | "cursor")[] = [];
  for (const [name, config] of Object.entries(BUILTIN_TARGETS)) {
    if (fs.existsSync(path.join(dir, config.dir))) {
      targets.push(name as "claude-code" | "cursor");
    }
  }
  return targets;
}

export function scanTarget(
  dir: string,
  targetName: "claude-code" | "cursor"
): ScanResult {
  const config = BUILTIN_TARGETS[targetName];
  const agents: ScannedAgent[] = [];
  const skills: ScannedSkill[] = [];
  const skipped: SkippedItem[] = [];

  const agentsDir = path.join(dir, config.dir, config.agentsSubdir);
  const skillsDir = path.join(dir, config.dir, config.skillsSubdir);

  // --- Scan agents ---
  if (fs.existsSync(agentsDir)) {
    let agentDirs: string[];
    try {
      agentDirs = fs
        .readdirSync(agentsDir, { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .map((d) => d.name);
    } catch (err) {
      skipped.push({
        path: agentsDir,
        reason: (err as NodeJS.ErrnoException).code === "EACCES"
          ? "Permission denied"
          : `Cannot read directory: ${(err as Error).message}`,
      });
      agentDirs = [];
    }

    for (const slug of agentDirs) {
      if (slug === "orchestrator") {
        skipped.push({ path: `${config.agentsSubdir}/${slug}`, reason: "Orchestrator (auto-generated)" });
        continue;
      }

      const agentFile = path.join(agentsDir, slug, "AGENT.md");
      if (!fs.existsSync(agentFile)) {
        skipped.push({ path: `${config.agentsSubdir}/${slug}`, reason: "No AGENT.md found" });
        continue;
      }

      try {
        const raw = fs.readFileSync(agentFile, "utf-8");
        const { data, content } = matter(raw);
        const fm = data as Record<string, unknown>;
        agents.push({
          slug,
          name: (fm.name as string) || slug,
          description: (fm.description as string) || "",
          role: (fm.role as string) || "general",
          skills: Array.isArray(fm.skills) ? (fm.skills as string[]) : [],
          content: raw,
        });
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code === "EACCES") {
          skipped.push({ path: `${config.agentsSubdir}/${slug}`, reason: "Permission denied" });
        } else {
          // No frontmatter or parse error — use defaults
          try {
            const raw = fs.readFileSync(agentFile, "utf-8");
            agents.push({
              slug,
              name: slug,
              description: "",
              role: "general",
              skills: [],
              content: raw,
            });
          } catch {
            skipped.push({ path: `${config.agentsSubdir}/${slug}`, reason: "Cannot read file" });
          }
        }
      }
    }
  }

  // --- Scan skills ---
  if (fs.existsSync(skillsDir)) {
    let skillDirs: string[];
    try {
      skillDirs = fs
        .readdirSync(skillsDir, { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .map((d) => d.name);
    } catch (err) {
      skipped.push({
        path: skillsDir,
        reason: (err as NodeJS.ErrnoException).code === "EACCES"
          ? "Permission denied"
          : `Cannot read directory: ${(err as Error).message}`,
      });
      skillDirs = [];
    }

    for (const slug of skillDirs) {
      const skillDir = path.join(skillsDir, slug);
      const relativePaths = walkDir(skillDir);

      if (relativePaths.length === 0) {
        skipped.push({ path: `${config.skillsSubdir}/${slug}`, reason: "Empty directory" });
        continue;
      }

      try {
        const files: SkillFile[] = relativePaths.map((relativePath) => ({
          relativePath,
          content: fs.readFileSync(path.join(skillDir, relativePath), "utf-8"),
        }));

        // Try to extract metadata from SKILL.md if present
        let name = slug;
        let description = "";
        const mainFile = files.find(
          (f) => f.relativePath === "SKILL.md" || f.relativePath === "skill.md"
        );
        if (mainFile) {
          try {
            const { data } = matter(mainFile.content);
            const fm = data as Record<string, string>;
            if (fm.name) name = fm.name;
            if (fm.description) description = fm.description;
          } catch {
            // Ignore frontmatter parse errors
          }
        }

        skills.push({ slug, name, description, files });
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code === "EACCES") {
          skipped.push({ path: `${config.skillsSubdir}/${slug}`, reason: "Permission denied" });
        } else {
          skipped.push({ path: `${config.skillsSubdir}/${slug}`, reason: `Error: ${(err as Error).message}` });
        }
      }
    }
  }

  return {
    target: targetName,
    projectName: path.basename(dir),
    agents,
    skills,
    skipped,
  };
}

export function generatePresetYaml(
  projectName: string,
  agents: ScannedAgent[],
  skills: ScannedSkill[]
): string {
  const preset = {
    name: projectName,
    description: `Imported from ${projectName}`,
    agents: ["orchestrator", ...agents.map((a) => a.slug)],
    skills: skills.map((s) => s.slug),
    constitution: {
      principles: [],
      conventions: [],
    },
    context: {
      projectDescription: `Imported project: ${projectName}`,
    },
  };
  return YAML.stringify(preset);
}
