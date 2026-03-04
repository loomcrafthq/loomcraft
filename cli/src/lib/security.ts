import fs from "node:fs";
import path from "node:path";

// ---------------------------------------------------------------------------
// Slug validation
// ---------------------------------------------------------------------------

const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;
const MAX_SLUG_LENGTH = 100;

export function validateSlug(slug: string): void {
  if (!slug || slug.length > MAX_SLUG_LENGTH || !SLUG_PATTERN.test(slug)) {
    throw new Error(
      `Invalid slug "${slug}". Slugs must be lowercase alphanumeric with hyphens, 1-${MAX_SLUG_LENGTH} chars.`
    );
  }
}

export function isValidSlug(slug: string): boolean {
  return !!slug && slug.length <= MAX_SLUG_LENGTH && SLUG_PATTERN.test(slug);
}

// ---------------------------------------------------------------------------
// Path sanitization
// ---------------------------------------------------------------------------

/**
 * Sanitize a relative file path to prevent directory traversal.
 * Rejects paths with `..` components, absolute paths, and null bytes.
 */
export function sanitizeRelativePath(relativePath: string): string {
  if (relativePath.includes("\0")) {
    throw new Error(`Invalid file path: contains null byte`);
  }

  const normalized = path.normalize(relativePath);

  // Reject absolute paths
  if (path.isAbsolute(normalized)) {
    throw new Error(`Invalid file path: absolute paths are not allowed`);
  }

  // Reject paths that escape the root via ..
  if (normalized.startsWith("..") || normalized.includes(`${path.sep}..`)) {
    throw new Error(`Invalid file path: directory traversal is not allowed`);
  }

  return normalized;
}

/**
 * Validate a target directory name (used for --target-dir).
 * Must be a relative path without traversal.
 */
export function validateTargetDir(dir: string): void {
  if (!dir || dir.includes("\0")) {
    throw new Error("Invalid target directory");
  }
  if (path.isAbsolute(dir)) {
    throw new Error("Target directory must be a relative path");
  }
  const normalized = path.normalize(dir);
  if (normalized.startsWith("..")) {
    throw new Error("Target directory must not traverse outside the project");
  }
}

// ---------------------------------------------------------------------------
// Safe walkDir (symlink-aware, depth-limited)
// ---------------------------------------------------------------------------

const TEXT_EXTENSIONS = new Set([
  ".md", ".ts", ".js", ".sh", ".dot", ".yaml", ".yml", ".json", ".css", ".html",
]);

const MAX_WALK_DEPTH = 10;

/**
 * Recursively walk a directory, returning relative paths of text files.
 * - Skips symlinks to prevent traversal and infinite loops
 * - Enforces a maximum recursion depth
 */
export function safeWalkDir(dir: string, base = "", depth = 0): string[] {
  if (depth > MAX_WALK_DEPTH) return [];

  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }

  const results: string[] = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const rel = base ? `${base}/${entry.name}` : entry.name;

    // Skip symlinks entirely
    try {
      const stat = fs.lstatSync(fullPath);
      if (stat.isSymbolicLink()) continue;
    } catch {
      continue;
    }

    if (entry.isDirectory()) {
      results.push(...safeWalkDir(fullPath, rel, depth + 1));
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
// Fetch with timeout
// ---------------------------------------------------------------------------

const DEFAULT_FETCH_TIMEOUT_MS = 15_000;

/**
 * Wrapper around fetch with an AbortController timeout.
 */
export function fetchWithTimeout(
  url: string | URL,
  init?: RequestInit,
  timeoutMs = DEFAULT_FETCH_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  return fetch(url, { ...init, signal: controller.signal }).finally(() =>
    clearTimeout(timer)
  );
}

// ---------------------------------------------------------------------------
// Content hash verification
// ---------------------------------------------------------------------------

export async function verifyContentHash(
  content: string,
  expectedHash: string | null
): Promise<boolean> {
  if (!expectedHash) return true; // nothing to verify
  const crypto = await import("node:crypto");
  const computed = crypto.createHash("sha256").update(content).digest("hex");
  return computed === expectedHash;
}
