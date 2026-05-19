#!/usr/bin/env bash
#
# Migration step 1 of 3 — fetch legacy project images from the production server.
#
# Pulls `~/public_html/projectImages/` (the legacy PHP site's image directory,
# ~5.1 MB per the 2026-05-02 inventory) down to a local `tmp/legacy-images/`
# directory. From here, `scripts/migrate-upload-cf-images.ts` uploads each
# image to Cloudflare Images.
#
# Usage: bash scripts/migrate-fetch-images.sh
#
# Requirements:
#   - SSH access via the sreardon_redesign_deploy key (~/.ssh/sreardon_redesign_deploy)
#   - Local scp (ships with OpenSSH; available out-of-the-box in Git Bash on Windows)
#
# Tool note: this used to use rsync, but Git Bash on Windows doesn't ship with
# rsync by default. scp is universal across SSH-having shells. Trade-off: scp
# always re-copies all files (no incremental mode). For a ~5 MB one-time
# migration that's a non-issue; if this script ever became a hot-loop on a
# larger payload, swap to rsync (Sean can install via scoop / cygwin / WSL).
#
# tmp/ is gitignored — the fetched images and the resulting CF URL mapping
# never enter git.

set -euo pipefail

REMOTE_USER="sreardon"
REMOTE_HOST="ssh.seanreardon.com"
REMOTE_PORT="7822"
REMOTE_KEY="${HOME}/.ssh/sreardon_redesign_deploy"
# Strip trailing slash deliberately — scp -r names the local destination after
# the remote SOURCE's basename when the source has no trailing slash AND the
# local dest doesn't exist yet, OR places the remote dir INSIDE the local
# dest when the dest is an existing directory. We remove the dest first so the
# remote `projectImages` lands as `tmp/legacy-images` cleanly.
REMOTE_PATH="/home/sreardon/public_html/projectImages"

LOCAL_DIR="tmp/legacy-images"

if [ ! -f "$REMOTE_KEY" ]; then
  echo "ERROR: SSH key not found at $REMOTE_KEY"
  exit 1
fi

# Ensure tmp/ exists; remove any prior legacy-images/ so scp doesn't nest
# the remote dir inside the existing dest.
mkdir -p tmp
rm -rf "$LOCAL_DIR"

echo "Fetching from ${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_PATH}/"
echo "    to local: $LOCAL_DIR/"
echo ""

scp -r -P "${REMOTE_PORT}" -i "${REMOTE_KEY}" \
  "${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_PATH}" \
  "${LOCAL_DIR}"

count=$(find "$LOCAL_DIR" -type f \( -iname '*.jpg' -o -iname '*.jpeg' -o -iname '*.png' -o -iname '*.webp' -o -iname '*.gif' \) | wc -l)
echo ""
echo "Done. Fetched $count image file(s) to $LOCAL_DIR/"
echo "Next: CF_API_TOKEN=... CF_ACCOUNT_ID=... npx tsx scripts/migrate-upload-cf-images.ts"
