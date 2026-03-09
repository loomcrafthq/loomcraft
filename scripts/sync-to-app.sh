#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(dirname "$SCRIPT_DIR")"
APP_DIR="$ROOT/../app"

if [ ! -d "$APP_DIR/.git" ]; then
  echo "Error: app repo not found at $APP_DIR"
  exit 1
fi

# Sync library (agents + presets only, skip skills)
echo "Syncing library/ → app/library/"
rm -rf "$APP_DIR/library/agents" "$APP_DIR/library/presets"
cp -r "$ROOT/library/agents" "$APP_DIR/library/agents"
cp -r "$ROOT/library/presets" "$APP_DIR/library/presets"

# Check if anything changed
cd "$APP_DIR"
if git diff --quiet library/; then
  echo "No changes to sync."
  exit 0
fi

# Show what changed
echo ""
git diff --stat library/
echo ""

# Commit and push
git add library/
git commit -m "chore: sync library from CLI

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
git push origin main

echo ""
echo "Done! Library synced and pushed to app."
