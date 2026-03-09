import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import YAML from "yaml";
import { BUILTIN_TARGETS } from "./target.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ScannedAgent {
  slug: string;
  name: string;
  description: string;
  content: string;
}

export interface SkippedItem {
  path: string;
  reason: string;
}

export interface ScanResult {
  target: "claude-code" | "cursor";
  projectName: string;
  agents: ScannedAgent[];
  skipped: SkippedItem[];
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
  const skipped: SkippedItem[] = [];

  const agentsDir = path.join(dir, config.dir, config.agentsSubdir);

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
        path: `${config.dir}/${config.agentsSubdir}`,
        reason: (err as NodeJS.ErrnoException).code === "EACCES"
          ? "Permission denied"
          : "Cannot read directory",
      });
      agentDirs = [];
    }

    for (const slug of agentDirs) {
      const agentFile = path.join(agentsDir, slug, "AGENT.md");
      if (!fs.existsSync(agentFile)) {
        skipped.push({ path: `${config.agentsSubdir}/${slug}`, reason: "No AGENT.md found" });
        continue;
      }

      try {
        const raw = fs.readFileSync(agentFile, "utf-8");
        const { data } = matter(raw);
        const fm = data as Record<string, unknown>;
        agents.push({
          slug,
          name: (fm.name as string) || slug,
          description: (fm.description as string) || "",
          content: raw,
        });
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code === "EACCES") {
          skipped.push({ path: `${config.agentsSubdir}/${slug}`, reason: "Permission denied" });
        } else {
          try {
            const raw = fs.readFileSync(agentFile, "utf-8");
            agents.push({
              slug,
              name: slug,
              description: "",
              content: raw,
            });
          } catch {
            skipped.push({ path: `${config.agentsSubdir}/${slug}`, reason: "Cannot read file" });
          }
        }
      }
    }
  }

  return {
    target: targetName,
    projectName: path.basename(dir),
    agents,
    skipped,
  };
}

export function generatePresetYaml(
  projectName: string,
  agents: ScannedAgent[]
): string {
  const preset = {
    name: projectName,
    description: `Imported from ${projectName}`,
    agents: agents.map((a) => a.slug),
    skills: [],
    workflow: {
      preparation: { source: "manual" },
      pipeline: agents.map((a) => ({ agent: a.slug })),
      verification: ["review-qa"],
      finalization: {
        commits: "conventional",
        branch: "feat/<ticket-id>-<description>",
      },
    },
  };
  return YAML.stringify(preset);
}
