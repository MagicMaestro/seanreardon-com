# seanreardon.com

Personal portfolio site for Sean Reardon. Astro + React islands, static export, deployed via rsync over SSH:7822 to A2 Hosting cPanel.

For the broader project context (foundation plan, optimizer-agent handoffs, post-idea backlog, site inventory, archives), see the planning project at `C:\Google Drive\Claude AI Projects\portfolio-redesign-agent\`.

## Quickstart

```bash
npm install
npm run dev      # http://localhost:4321
npm run build    # static output to ./dist/
npm run preview  # serve the built output
```

## Structure

```
src/
├─ content/
│  ├─ writing/        # MDX retrospective posts
│  ├─ work/           # MDX project pages (10 to migrate from MariaDB)
│  └─ config.ts       # content collection schemas
├─ pages/             # routes (filesystem-mapped)
├─ layouts/           # shared page layouts
├─ components/
│  ├─ astro/          # static .astro components (Header, Footer, ConsentBanner stub)
│  └─ react/          # interactive islands (AI features, when v1.x lands)
└─ styles/            # global CSS + design tokens
public/               # static assets (favicon, images)
deploy/               # deploy artifacts (.htaccess production/staging, deploy.sh)
```

## Conventions

- **Privacy compliance:** GDPR + CPRA-lite, project-wide. Consent banner before any tracking; "Do Not Sell or Share" footer link; privacy policy listing all data flows. The consent banner is currently a stub — wire it before adding any tracking script (GA4 etc.) to the layout `<head>`.
- **Positioning rule:** the site never states Sean is looking for work or available for hire. Audit copy with this lens.
- **Content model:** ship-and-explain. Each shipped milestone gets a short retrospective post (300–600 words). Drafts are PRs.
- **Mechanical motif:** preserve the gears/nozzles personality. Motion rewards attention, never demands it (no constantly-running animations).

## Stack

- **Astro 5** — static export, content-first
- **React 18** — islands only, for interactive components and (future) AI features
- **MDX** — for retrospective posts and project writeups
- **Vanilla CSS** with CSS modules — hand-crafted, design tokens via custom properties
- **TypeScript** — strict mode

## Deploy

GitHub Actions builds the static artifact and rsyncs to `/home/sreardon/staging/` (staging) or `/home/sreardon/public_html/` (production) on the A2 Hosting VPS over SSH on port 7822, using a deploy key scoped to the `sreardon` cPanel user. See `deploy/` (forthcoming).

## Origin

Replaces the 2015-era PHP site at seanreardon.com. Reposition: from "Your Story, Your Style" service-pitch to AI-integration-capability portfolio, with the photography site (Angular, separate repo) shipping in parallel as the flagship work sample.
