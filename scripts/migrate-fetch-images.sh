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
#   - Local rsync installed
#
# tmp/ is gitignored — the fetched images and the resulting CF URL mapping
# never enter git.

set -euo pipefail

REMOTE_USER="sreardon"
REMOTE_HOST="ssh.seanreardon.com"
REMOTE_PORT="7822"
REMOTE_KEY="${HOME}/.ssh/sreardon_redesign_deploy"
REMOTE_PATH="/home/sreardon/public_html/projectImages/"

LOCAL_DIR="tmp/legacy-images"

if [ ! -f "$REMOTE_KEY" ]; then
  echo "ERROR: SSH key not found at $REMOTE_KEY"
  exit 1
fi

mkdir -p "$LOCAL_DIR"

echo "Fetching from ${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_PATH}"
echo "    to local: $LOCAL_DIR/"
echo ""

rsync -avz \
  -e "ssh -i ${REMOTE_KEY} -p ${REMOTE_PORT}" \
  "${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_PATH}" \
  "${LOCAL_DIR}/"

count=$(find "$LOCAL_DIR" -type f \( -iname '*.jpg' -o -iname '*.jpeg' -o -iname '*.png' -o -iname '*.webp' -o -iname '*.gif' \) | wc -l)
echo ""
echo "Done. Fetched $count image file(s) to $LOCAL_DIR/"
echo "Next: CF_API_TOKEN=... CF_ACCOUNT_ID=... npx tsx scripts/migrate-upload-cf-images.ts"
