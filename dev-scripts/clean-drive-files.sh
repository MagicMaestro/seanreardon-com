#!/bin/bash
# clean-drive-files.sh — remove Google Drive auto-generated desktop.ini files
#
# Run before:
#   - git pull (to avoid sync conflicts)
#   - any tool that walks .git/ directly (gitleaks, BFG, git-filter-repo)
#   - any pre-commit hook that scans the repo
#
# This is idempotent and safe to run repeatedly. Exit 0 always.
#
# A git alias is configured in this repo so `git clean-drive` runs this script.

set -e

# Clean .git/ internals (gitignore doesn't apply here)
find .git -name "desktop.ini" -delete 2>/dev/null || true

# Clean working tree (.gitignore catches them at staging time, but this prunes
# files that might already exist before staging)
find . -name "desktop.ini" \
    -not -path "./node_modules/*" \
    -not -path "./dist/*" \
    -not -path "./.astro/*" \
    -delete 2>/dev/null || true

echo "desktop.ini files cleaned."
