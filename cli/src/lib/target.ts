export interface TargetConfig {
  name: string;
  description: string;
  dir: string;
  agentsSubdir: string;
  skillsSubdir: string;
  orchestratorFile: string;
  contextFile: string;
}

// --- Built-in targets registry ---

export const BUILTIN_TARGETS: Record<string, TargetConfig> = {
  "claude-code": {
    name: "claude-code",
    description: "Claude Code — .claude/ + CLAUDE.md",
    dir: ".claude",
    agentsSubdir: "agents",
    skillsSubdir: "skills",
    orchestratorFile: "orchestrator.md",
    contextFile: "CLAUDE.md",
  },
  cursor: {
    name: "cursor",
    description: "Cursor — .cursor/ + .cursorrules",
    dir: ".cursor",
    agentsSubdir: "agents",
    skillsSubdir: "skills",
    orchestratorFile: "orchestrator.md",
    contextFile: ".cursorrules",
  },
};

export const DEFAULT_TARGET = "claude-code";

export function listTargetNames(): string[] {
  return Object.keys(BUILTIN_TARGETS);
}

export function resolveTarget(
  targetName: string,
  customDir?: string,
  customContextFile?: string
): TargetConfig {
  const builtin = BUILTIN_TARGETS[targetName];
  if (builtin) return builtin;

  if (targetName === "custom") {
    if (!customDir || !customContextFile) {
      throw new Error(
        'Target "custom" requires --target-dir and --context-file.'
      );
    }
    return {
      name: "custom",
      description: `Custom — ${customDir}/ + ${customContextFile}`,
      dir: customDir,
      agentsSubdir: "agents",
      skillsSubdir: "skills",
      orchestratorFile: "orchestrator.md",
      contextFile: customContextFile,
    };
  }

  const available = [...listTargetNames(), "custom"].join(", ");
  throw new Error(
    `Unknown target "${targetName}". Available: ${available}.`
  );
}
