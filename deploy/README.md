# deploy/

Deploy artifacts and Apache configuration consumed by the GitHub Actions workflows.

## Files

- `htaccess.staging` — `.htaccess` for `staging.seanreardon.com`. Adds `X-Robots-Tag: noindex` for all responses (staging shouldn't be indexed), forces HTTPS, sets cache headers for static assets. Copied to `dist/.htaccess` during the deploy-staging workflow.
- `htaccess.production` — `.htaccess` for `seanreardon.com` (production). Allows indexing, includes 301 redirects from the legacy PHP routes (`home.php → /`, `about.php → /about/`, etc.), forces HTTPS, sets cache headers. Per-project query-param redirects (`project.php?projID=N → /work/<slug>/`) are TBD during cutover.
- `api-files.txt` — rsync manifest (`--files-from`) for the AI search Node app deploy. Lists exactly what gets copied to `/home/sreardon/apps/portfolio-search/`: the `app.js` cPanel entrypoint shim, `api-server/`, `src/lib/search/`, `public/search-index.json`, `tsconfig.json`, `package.json` + lockfile. Deliberately omits `.env`, `logs/`, `tmp/`, `node_modules/` — those are server-managed (established by `optimizer-handoffs/009-portfolio-search-app-deploy.md`) and the deploy never touches them.
- `README.md` — this file.

## Workflows that consume these

- `.github/workflows/deploy-staging.yml` — runs on push to `main` or via manual trigger. Builds the Astro site, copies `htaccess.staging` to `dist/.htaccess`, then rsyncs `dist/` to `/home/sreardon/staging/` over SSH:7822.
- `.github/workflows/deploy-api.yml` — runs on push to `main` when any input to the runtime or search corpus changes (or via manual trigger). Rebuilds `public/search-index.json`, rsyncs the api-files.txt manifest to `/home/sreardon/apps/portfolio-search/`, runs `npm ci --omit=dev` on the server, touches `tmp/restart.txt` to swap Passenger workers, then health-checks the live endpoint at `https://seanreardon.com/api/search`. Runs in parallel with deploy-staging on the same push when both are triggered. First-deploy cold-start is ~3–5s (MiniLM model downloads to `~/.cache/transformers/` on first run); warm-query path is ~50ms.
- `.github/workflows/deploy-production.yml` — runs on a tagged release matching `v*` (e.g., `v1.0.0`, `v1.2.3-rc1`) or via manual `workflow_dispatch`. Builds the Astro site with the same PUBLIC_* env vars as staging, copies `htaccess.production` to `dist/.htaccess`, **backs up `~/public_html/` to a timestamped dir under `~/backups/`** (keeping the 5 most recent), rsyncs `dist/` to `/home/sreardon/public_html/` with `--delete` (which wipes the legacy PHP site and the `/disney/` subdirectory), **purges the Cloudflare cache** for the whole seanreardon.com zone, then **smoke-tests 5 URLs + verifies version.txt contains the deployed commit SHA**. Production deploys are explicit: every ship creates a git tag as a stable named anchor. The legacy /disney/ app is preserved separately in this project's `archive/disney-2026-05-02/` tarball (see `memory/project-sites-and-roadmap.md` §3), so the --delete wipe is intentional.

## Required GitHub secrets

Configure under repo Settings → Secrets and variables → Actions:

- `DEPLOY_SSH_KEY` — the **private** key whose public counterpart is authorized for the `sreardon` cPanel user. The `sreardon_redesign_deploy` ed25519 key generated 2026-05-02 is the canonical one (`C:\Users\seanr\.ssh\sreardon_redesign_deploy` on the dev machine — paste its contents into the secret). Used by deploy-staging, deploy-api, AND deploy-production.
- `CF_API_TOKEN` — **Production deploy only.** Cloudflare API token scoped to **Zone:Cache Purge** permission on the `seanreardon.com` zone (least privilege — purge-only, no DNS / firewall / read access). Generate at https://dash.cloudflare.com/profile/api-tokens via "Create Custom Token" → permission row `Zone | Cache Purge | Purge` → zone resources `Include | Specific zone | seanreardon.com`. Token shown ONCE on creation — paste into this secret immediately, then recreate if lost.
- `CF_ZONE_ID` — **Production deploy only.** The 32-character hex Zone ID for `seanreardon.com`. Found on the zone's Cloudflare overview page, right sidebar under the "API" heading.

The workflows do NOT need a separate `KNOWN_HOSTS` secret; they use `ssh-keyscan` against the server at runtime.

## Server-side prerequisites (one-time)

For the staging deploy to actually serve content at `staging.seanreardon.com`:

1. The DNS A record `staging.seanreardon.com` → `216.137.187.42` exists in Cloudflare (added 2026-05-02; gray-cloud / DNS-only).
2. **A cPanel subdomain `staging.seanreardon.com` must be created** with document root `/home/sreardon/staging/`. As of repo init this has NOT been done — file an optimizer brief or create via WHM UI when ready to deploy. Without this, the rsync succeeds but no Apache vhost serves the content at `https://staging.seanreardon.com/`.

Production cutover prerequisites land in a follow-up brief when ready.

## Conventions

- Both `.htaccess` files include `RewriteRule` directives for HTTPS enforcement, but cPanel + AutoSSL already issues certs; the redirect is belt-and-suspenders.
- Cache TTL is 1 year for hashed assets (Astro outputs immutable filenames in `_astro/`), 5 minutes for HTML on staging, 1 hour for HTML on production.
- The `X-Robots-Tag: noindex, nofollow, noarchive, nosnippet` header on staging is the strongest possible signal to compliant crawlers; combined with the staging subdomain not being linked from anywhere public, accidental indexing is highly unlikely.

## Failure modes

- **Workflow fails at `Configure SSH` step** → `DEPLOY_SSH_KEY` secret missing or wrong format. Paste the private key INCLUDING the `-----BEGIN OPENSSH PRIVATE KEY-----` and `-----END OPENSSH PRIVATE KEY-----` lines.
- **Workflow fails at `Rsync to staging` (or `Rsync to production`)** → SSH auth issue. The `sreardon` cPanel user's `~/.ssh/authorized_keys` may have lost the deploy key (cPanel sometimes rewrites this). Re-authorize via the cPanel UI or via root SSH. See `optimizer-handoffs/004-sreardon-ssh-key-auth-fix.md` and `005-...followup.md` for the original fix; same diagnostic path applies.
- **Workflow succeeds but `https://staging.seanreardon.com/` returns 404 or shows the main site** → cPanel subdomain not created (see prerequisite #2 above).
- **`version.txt` not reachable** → either the cPanel subdomain isn't routed, or the deploy hasn't yet synced. The workflow's `Verify deploy` step prints the version.txt if reachable; failure here is informational, not fatal on staging; fatal on production (the smoke test verifies the commit SHA in version.txt matches the deployed commit).
- **Production deploy fails at `Purge Cloudflare cache`** → `CF_API_TOKEN` or `CF_ZONE_ID` secret missing/wrong, OR the token's permissions don't include `Zone:Cache Purge` on `seanreardon.com`. Inspect the CF response printed in the workflow log; CF returns explicit `errors[]` in its JSON.
- **Production deploy fails at `Smoke test production`** → one of the 5 representative URLs returned non-2xx, OR `version.txt`'s commit doesn't match the deployed commit. Site MAY be in a partial-deploy state; check immediately. Rollback runbook below.

## Production rollback runbook

If a production deploy ships something broken:

```bash
# 1. SSH to the server
ssh -i ~/.ssh/sreardon_redesign_deploy -p 7822 sreardon@ssh.seanreardon.com

# 2. List the 5 most recent backups (newest first)
ls -1dt ~/backups/public_html-*/ | head -5

# 3. Restore from the chosen backup. The trailing slash on the source
#    is critical (rsync semantics: copy the CONTENTS of the dir, not
#    the dir itself).
rsync -av --delete ~/backups/public_html-<TIMESTAMP>/ ~/public_html/

# 4. Purge Cloudflare cache via the dashboard:
#    https://dash.cloudflare.com/ → seanreardon.com → Caching → Configuration → "Purge Everything"
#    (Or re-run the failing workflow with workflow_dispatch — the CF-purge step alone won't work
#    on its own; the whole workflow has to re-run.)
```

Backups are auto-pruned to the 5 most recent. If the broken deploy was the 5th+ recent, the backup may already be gone — recover from git history by re-running an older tag's deploy via `workflow_dispatch`.
