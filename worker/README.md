# API Worker

One Cloudflare Worker serving the static Astro site's two `/api/*` endpoints.

- **`/api/contact`** — receives contact-form submissions, validates them, verifies a Cloudflare Turnstile challenge, and sends two emails via Resend (one notification to Sean, one confirmation to the submitter).
- **`/api/exam-save`** — saves and restores an in-progress [practice exam](../src/pages/real-estate-practice.astro) as one JSON object per save in a private R2 bucket, keyed by a resume code. Added in SPR-0097; **needs the one-time R2 setup in step 5 below before it will work.**

`worker/index.ts` is the entrypoint and routes by pathname; each endpoint lives in its own module and they share nothing but the origin allowlist.

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
wrangler.toml               ← Worker config + routes + bindings + non-secret vars
worker/index.ts             ← entrypoint; routes /api/* to the handler that owns it
worker/contact-form.ts      ← the contact endpoint (unchanged since SPR-0049)
worker/exam-save.ts         ← the practice-exam save/resume endpoint
worker/http.ts              ← shared CORS/JSON helpers + the origin allowlist
worker/tsconfig.json        ← TS config scoped to the Worker (Workers types)
worker/README.md            ← this file
```

The save endpoint also imports `src/lib/exam/resume-code.ts` and `src/lib/exam/types.ts`, so the resume-code format and the saved-attempt shape have exactly one definition shared with the browser island. Type-check the Worker on its own with `npm run worker:check`. Two config details that are
easy to undo by accident, and are recorded here because `tsconfig.json` is validated as strict
JSON by a pre-commit hook and so cannot carry comments of its own:

- **`worker/` is in the root `tsconfig.json`'s `exclude`.** The Worker uses runtime globals
  (`R2Bucket`, `ExecutionContext`) that only exist under `@cloudflare/workers-types`, which the
  root config has no reason to load. Without the exclusion the root `tsc` fails on them.
- **`worker/tsconfig.json` sets `allowImportingTsExtensions`.** The Worker imports
  `../src/lib/exam/*.ts` with the `.ts` extension the rest of the repo uses. It is valid here
  because the config is `noEmit`, and wrangler bundles through esbuild, which resolves it.

## One-time Sean setup

Before the form will work, complete tasks 1–4. Task 5 is separate and is what the practice-exam save needs:

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

### 5. Create the R2 bucket for practice-exam saves (SPR-0097)

The `/api/exam-save` endpoint will return 500s until this exists. Four steps, all in the Cloudflare dashboard except the last.

**5a. Create the bucket.** Dashboard → **R2** → *Create bucket*.

> **R2 wants a payment method on file before it will let you create a bucket**, even though
> everything here sits inside the free tier (10 GB-month, 1M Class A ops, 10M Class B ops).
> It is a verification step, not a charge. Sean already has a card on Cloudflare for the
> Images Basic plan used by another project, so this is existing capacity rather than a new
> financial commitment — but it is worth knowing the prompt is not a mistake.

- Name: **`seanreardon-exam-saves`** (must match `bucket_name` in `wrangler.toml`)
- Location: Automatic
- **Leave public access OFF.** This is load-bearing, not a default worth accepting idly: the resume code is the only credential a save has, so a publicly reachable bucket would be an enumerable list of exams in progress. Nothing but the Worker should ever read it.

**5b. Add the 14-day lifecycle rule.** Bucket → **Settings** → *Object lifecycle rules* → *Add rule*.

- Prefix: `saves/`
- Action: **Delete objects** → *after 14 days from upload*

This is what actually enforces the retention promised in the privacy policy. The endpoint independently refuses to open a save older than 14 days, because Cloudflare only commits to removing expired objects *within 24 hours* — without the check in code, "two weeks" would be "two weeks, give or take a day."

**5c. Add a rate-limiting rule.** Dashboard → **Security** → *WAF* → *Rate limiting rules* → *Create rule*.

**Check first whether the zone's one free rule is already in use.** On Cloudflare's Free plan a zone gets **exactly one** rate limiting rule, and its settings are fixed: counting period 10 s, mitigation timeout 10 s, counted per IP, and the rule expression can only use **Path** and **Verified Bot** — *Request Method is not available*. If that single rule is already protecting something else, skip this step and read the honest-limits note below instead of displacing it.

- Name: `exam-save limit`
- If incoming requests match: `URI Path` *starts with* `/api/exam-save`
- Rate: **5 requests per 10 seconds**, per IP
- Action: Block, 10 seconds

Because Request Method is unavailable on Free, this limits restores (GET) as well as saves (POST). That is fine — a visitor restores once and saves a handful of times in a sitting, so five requests per ten seconds is far above honest use.

**Be clear-eyed about what this does and does not buy.** A 10-second window with a 10-second block is a speed bump, not a wall: it caps a single IP at roughly one request per second sustained, which is still millions of writes a month if someone is determined and patient. The things actually holding the line are in the Worker — the 16 KB body cap, and rebuilding every stored object from validated fields so the bucket cannot hold anything but a saved attempt. The realistic worst case is R2 operation cost rather than a data problem; Class A operations are $4.50/million past the free 1M, so even a sustained abusive month is tens of dollars, not hundreds. **Set a billing notification** (Dashboard → *Manage Account* → *Billing* → *Notifications*) so a surprise shows up as an email rather than an invoice. If this ever stops being theoretical, the proportionate fix is a Turnstile token on save — friction mid-exam, which is why it is not there now.

**5d. Deploy.** From the repo root:

```bash
npm run worker:deploy
```

The R2 binding comes from `wrangler.toml`, so there is no secret to set for this one.

#### Verifying it works

```bash
# Save (expect: {"code":"20261017-XXXXXXXX","saved":"..."} )
curl -sS -X POST https://seanreardon.com/api/exam-save   -H 'Content-Type: application/json' -H 'Origin: https://seanreardon.com'   -d '{"localDate":"'"$(date +%Y%m%d)"'","attempt":{"v":1,"bankVersion":1,"questionIds":["law-of-agency-0001"],"answers":{"law-of-agency-0001":2},"revealed":[],"secondsLeft":null}}'

# Restore it (expect the same attempt back)
curl -sS https://seanreardon.com/api/exam-save/<code-from-above>   -H 'Origin: https://seanreardon.com'

# Rejected: a payload that is not a saved attempt (expect 400 "Malformed save.")
curl -sS -X POST https://seanreardon.com/api/exam-save   -H 'Content-Type: application/json' -H 'Origin: https://seanreardon.com'   -d '{"localDate":"'"$(date +%Y%m%d)"'","attempt":{"anything":"else"}}'
```

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
