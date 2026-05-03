# deploy/

Deploy artifacts and Apache configuration consumed by the GitHub Actions workflows.

## Files

- `htaccess.staging` — `.htaccess` for `staging.seanreardon.com`. Adds `X-Robots-Tag: noindex` for all responses (staging shouldn't be indexed), forces HTTPS, sets cache headers for static assets. Copied to `dist/.htaccess` during the deploy-staging workflow.
- `htaccess.production` — `.htaccess` for `seanreardon.com` (production). Allows indexing, includes 301 redirects from the legacy PHP routes (`home.php → /`, `about.php → /about/`, etc.), forces HTTPS, sets cache headers. Per-project query-param redirects (`project.php?projID=N → /work/<slug>/`) are TBD during cutover.
- `README.md` — this file.

## Workflows that consume these

- `.github/workflows/deploy-staging.yml` — runs on push to `main` or via manual trigger. Builds the Astro site, copies `htaccess.staging` to `dist/.htaccess`, then rsyncs `dist/` to `/home/sreardon/staging/` over SSH:7822.
- `.github/workflows/deploy-production.yml` — TBD. Will run on a tagged release (e.g. `v1.0.0`) after staging is verified. Will copy `htaccess.production` and rsync to `/home/sreardon/public_html/`. Production deploy is gated on the legacy PHP site being archived first.

## Required GitHub secrets

Configure under repo Settings → Secrets and variables → Actions:

- `DEPLOY_SSH_KEY` — the **private** key whose public counterpart is authorized for the `sreardon` cPanel user. The `sreardon_redesign_deploy` ed25519 key generated 2026-05-02 is the canonical one (`C:\Users\seanr\.ssh\sreardon_redesign_deploy` on the dev machine — paste its contents into the secret).

The workflow does NOT need a separate `KNOWN_HOSTS` secret; it uses `ssh-keyscan` against the server at runtime.

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
- **Workflow fails at `Rsync to staging`** → SSH auth issue. The `sreardon` cPanel user's `~/.ssh/authorized_keys` may have lost the deploy key (cPanel sometimes rewrites this). Re-authorize via the cPanel UI or via root SSH. See `optimizer-handoffs/004-sreardon-ssh-key-auth-fix.md` and `005-...followup.md` for the original fix; same diagnostic path applies.
- **Workflow succeeds but `https://staging.seanreardon.com/` returns 404 or shows the main site** → cPanel subdomain not created (see prerequisite #2 above).
- **`version.txt` not reachable** → either the cPanel subdomain isn't routed, or the deploy hasn't yet synced. The workflow's `Verify deploy` step prints the version.txt if reachable; failure here is informational, not fatal.
