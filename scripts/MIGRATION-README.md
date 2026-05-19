# Legacy-project image migration

Three-step pipeline that pulls legacy project images from the production server, uploads them to Cloudflare Images, and populates the `mainImg` / `otherImg` frontmatter fields on `src/content/work/*.mdx` entries with the resulting CF delivery URLs.

The work entries already have `legacyMainImg` / `legacyOtherImg` placeholders pointing at the original filenames in the legacy site's `~/public_html/projectImages/` directory. This pipeline replaces those placeholders with live CF Images URLs while preserving the legacy fields as a paper trail.

## Prerequisites

- SSH access via `~/.ssh/sreardon_redesign_deploy` (already provisioned per server-environment memory)
- Local `rsync` and Node 22 (already required for the rest of the build)
- A Cloudflare API token with the `Images:Edit` permission on the account that hosts Sean's Images Basic subscription
- The Cloudflare Account ID for that same account

`CF_API_TOKEN` is a secret — never commit, never paste into the shell history without `set +o history` or equivalent if shell history is shared. `CF_ACCOUNT_ID` is an operational detail (per `feedback-secret-hygiene.md`), not a secret, but kept in env for flexibility.

## Sequence

```bash
# Step 1 — fetch legacy images from server to local tmp/
bash scripts/migrate-fetch-images.sh

# Step 2 — upload to Cloudflare Images; writes tmp/legacy-image-cf-urls.json
CF_API_TOKEN=<your-token> CF_ACCOUNT_ID=<your-account-id> \
  npx tsx scripts/migrate-upload-cf-images.ts

# Step 3 — populate mainImg / otherImg fields in work MDX files
npx tsx scripts/migrate-update-mdx-images.ts
```

## What each step does

### `migrate-fetch-images.sh`

Rsyncs `~/public_html/projectImages/` from the production server to `tmp/legacy-images/` locally. About 5.1 MB total per the 2026-05-02 inventory. The script uses the deploy SSH key and port 7822.

If the legacy projectImages directory has moved or been renamed on the server, edit the `REMOTE_PATH` constant at the top of the script.

### `migrate-upload-cf-images.ts`

Iterates the local images and POSTs each one to the CF Images API at `https://api.cloudflare.com/client/v4/accounts/<account-id>/images/v1`. Captures the returned delivery URL (the `public` variant by default) and writes a `{ legacy-filename: cf-url }` mapping to `tmp/legacy-image-cf-urls.json`.

**Idempotent**: subsequent runs skip files already in the mapping. Delete the JSON to force re-upload. Partial-run safe: the mapping is written after each successful upload, so a mid-run failure leaves the completed uploads recorded.

If the script reports failures, the most likely causes are an invalid token, the wrong account ID, or CF Images rate limits (rare at this volume).

### `migrate-update-mdx-images.ts`

Reads the JSON mapping, then for each work MDX file:
- Looks up `legacyMainImg`'s value in the mapping. If found, inserts (or replaces) the `mainImg` field with the CF URL, positioned immediately above the `legacyMainImg` line.
- Splits `legacyOtherImg` on commas, maps each filename through the JSON, joins the resulting URLs with commas, writes `otherImg`.

No network calls, no secrets. The `legacy*` fields remain in place for traceability.

## Cleanup

After the migration is verified (Sean runs `npm run dev` and the projects pages render with images), the `tmp/` directory can be deleted — it's gitignored regardless. Re-running the pipeline rebuilds `tmp/` from scratch.

The `legacyMainImg` / `legacyOtherImg` fields can stay in the work MDX frontmatter indefinitely as a migration paper trail (per the existing pattern), or they can be stripped in a follow-up commit once the migration is confirmed stable.

## Out of scope

- **Image rendering in the project detail page** (`src/pages/projects/[slug].astro`) — the page currently doesn't render `project.data.mainImg`. Adding `<img src={project.data.mainImg} alt={...}>` is a small follow-up; the LaserCard listing on `/projects/` also doesn't show images by current design.
- **CF Images variant configuration** — the script picks the `public` variant. If Sean's account uses a custom variant (different sizing, format), edit `PREFERRED_VARIANT` at the top of the upload script.
- **Image alt text** — the migration carries the legacy filename forward, not alt text. Alt text is editorial work to add manually per project.
