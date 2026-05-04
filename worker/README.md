# Contact form Worker

A Cloudflare Worker that receives contact-form submissions from the static Astro site, validates them, verifies a Cloudflare Turnstile challenge, and sends two emails via Resend (one notification to Sean, one confirmation to the submitter).

## Why Turnstile (not reCAPTCHA)

The legacy PHP site used Google reCAPTCHA v3. The new site uses **Cloudflare Turnstile** instead, for two reasons:

1. **Privacy alignment.** Turnstile is cookieless and doesn't fingerprint visitors in default mode. reCAPTCHA collects IP, browser fingerprint, mouse-movement and click patterns, and sends them to Google on every page load — which clashes with the rest of this site's privacy-respecting stack (CF Web Analytics, no third-party trackers, no cookie banner needed).
2. **Stack consistency.** The site is already on Cloudflare for analytics, images, DNS, and now Workers. Turnstile is a CF product, free, and adds no new vendor relationship.

The privacy policy reflects the Turnstile choice — see `src/pages/privacy/index.astro`.

## Why a Worker (and not the cPanel origin)

The site itself ships as a static Astro export — no Node runtime in the request path. Rather than pull forward the foundation plan's deferred Application Manager / Node-app infra just for a contact form, the form submits to a Cloudflare Worker bound to `/api/contact*` on the same domain. The Worker has the secrets, talks to Turnstile + Resend, and responds with JSON. The site stays fully static.

Free tier covers this entirely (CF Workers: 100k requests/day; we'll see <1k/year).

## File map

```
wrangler.toml               ← Worker config + routes + non-secret vars
worker/contact-form.ts      ← the Worker source
worker/tsconfig.json        ← TS config scoped to the Worker (Workers types)
worker/README.md            ← this file
```

## One-time Sean setup

Before the form will work, complete these four tasks in order:

### 1. Register a Turnstile widget at Cloudflare

1. Go to [dash.cloudflare.com](https://dash.cloudflare.com) → **Turnstile** (left sidebar)
2. Click **Add site** (or **Add widget**, depending on dashboard wording)
3. Fill the form:
   - **Site name:** `seanreardon.com (contact form)` or anything memorable
   - **Hostnames:** add `seanreardon.com` and `staging.seanreardon.com` (one per line). Don't add `localhost` — for local dev, use the documented test keys instead (see step 5b below).
   - **Widget mode:** select **Invisible** (no visible challenge UI; runs fully in the background)
   - **Pre-clearance:** off (not needed for a contact form)
4. Click **Create**
5. Copy the **Site Key** (public — for build env var) and the **Secret Key** (private — for Worker secret)

### 2. Generate a Resend API key for transactional sending

You already have a Resend account from the Listmonk setup; this just adds a new key for the contact-form Worker (separate from any SMTP credentials Listmonk uses).

1. Go to [resend.com/api-keys](https://resend.com/api-keys)
2. Click **+ Create API Key**
3. Settings:
   - **Name:** `seanreardon-com-contact-worker`
   - **Permission:** **Sending access** (NOT full access — principle of least privilege)
   - **Domain:** select `seanreardon.com` if domain-scoping is offered
4. Click **Add** and **copy the key immediately** — it's shown only once. Starts with `re_`.

The `from` address used by the Worker is `contact@seanreardon.com`. Resend works at the domain level, so as long as `seanreardon.com` is verified (it should be from the Listmonk setup), any address on it can send. Sanity-check at [resend.com/domains](https://resend.com/domains).

### 3. Set Worker secrets via wrangler

After installing wrangler (`npm install` from the repo root):

```bash
npx wrangler login                              # opens browser for one-time CF auth
npx wrangler secret put TURNSTILE_SECRET_KEY    # paste the secret from step 1
npx wrangler secret put RESEND_API_KEY          # paste the key from step 2
```

Verify with `npx wrangler secret list` — both names should appear (values hidden).

### 4. Add the public Turnstile site key as a GitHub repo variable

1. Go to your repo's **Settings → Secrets and variables → Actions → Variables tab**
2. Click **New repository variable**
3. **Name:** `PUBLIC_TURNSTILE_SITE_KEY`
4. **Value:** the site key from step 1 (the public one)
5. Save

This gets baked into the static build at deploy time — the deploy workflow already references it.

## Local development

```bash
# install once (after first pull):
npm install

# run the Worker locally on http://localhost:8787:
npm run worker:dev
```

For local form testing without registering `localhost` as a Turnstile hostname (don't — see step 1), use Cloudflare's documented **test keys** that always pass:

- Site key: `1x00000000000000000000AA`
- Secret key: `1x0000000000000000000000000000000AA`

(There are also always-fail and always-challenge variants; see [developers.cloudflare.com/turnstile/troubleshooting/testing](https://developers.cloudflare.com/turnstile/troubleshooting/testing/).)

To use them in local dev, set `PUBLIC_TURNSTILE_SITE_KEY` in `.env` to the test site key, and override `TURNSTILE_SECRET_KEY` in your local Worker session (via `npx wrangler dev --var`).

## Deploy

```bash
npm run worker:deploy
```

Wrangler reads `wrangler.toml`, bundles the Worker, and deploys to Cloudflare. The routes in `wrangler.toml` are configured at deploy time — Cloudflare automatically intercepts matching URLs.

After deploy, verify the Worker is bound to its routes:

- [dash.cloudflare.com](https://dash.cloudflare.com) → Workers & Pages → seanreardon-contact → Triggers → should list both routes

## Smoke test

After Worker deploy + secrets set + GH variable added + a fresh site deploy:

1. Visit `https://staging.seanreardon.com/contact/`
2. Fill out the form, submit
3. Two emails should arrive:
   - Notification to `sean@seanreardon.com` with form contents (reply-to is the submitter)
   - Confirmation to whatever email you submitted (reply-to is `sean@seanreardon.com`)

If something fails, the form's status message will surface the error. For deeper debugging, `wrangler tail` shows real-time Worker logs:

```bash
npm run worker:tail
```

## Privacy disclosure (per CPRA-lite standing rule)

The contact form is documented in [src/pages/privacy/index.astro](../src/pages/privacy/index.astro) — fields collected, retention period (90 days), Resend as a third-party processor, Cloudflare Turnstile as the bot-verification layer. If form fields ever change, update the privacy policy too.
