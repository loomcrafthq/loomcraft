const TELEMETRY_URL = "https://loomcraft.dev/api/t";

export function trackAdd(ref: string, type: "agent" | "preset"): void {
  if (process.env.LOOMCRAFT_NO_TELEMETRY || process.env.DO_NOT_TRACK) return;

  try {
    const params = new URLSearchParams({ event: "add", ref, type });
    fetch(`${TELEMETRY_URL}?${params.toString()}`).catch(() => {});
  } catch {
    // Never break the CLI
  }
}

export function trackFind(query: string, resultCount: number): void {
  if (process.env.LOOMCRAFT_NO_TELEMETRY || process.env.DO_NOT_TRACK) return;

  try {
    const params = new URLSearchParams({
      event: "find",
      q: query,
      n: String(resultCount),
    });
    fetch(`${TELEMETRY_URL}?${params.toString()}`).catch(() => {});
  } catch {
    // Never break the CLI
  }
}
