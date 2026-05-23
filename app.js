/**
 * Entry shim for cPanel Application Manager (Phusion Passenger).
 *
 * Passenger expects the application root to contain an `app.js` file. The
 * real server logic lives in TypeScript at `api-server/index.ts`. This file
 * is a tiny ESM bridge: register tsx as a TypeScript loader, then dynamically
 * import the real entrypoint so its `.ts` imports resolve through the loader.
 *
 * Why a shim (instead of compiling .ts → .js at deploy time): keeps the
 * TypeScript source as the single source of truth for the server module;
 * avoids a separate build step + artifact directory; tsx is in production
 * deps (~6 MB) so the trade-off is small.
 *
 * Why fire-and-forget instead of top-level `await` on the import: Passenger's
 * node-loader.js loads this file via CommonJS `require()`. Node 22.12+
 * enforces `ERR_REQUIRE_ASYNC_MODULE` for require() of any ESM graph with
 * top-level await, so `await import(...)` here makes Passenger refuse to
 * spawn the worker. Dropping the `await` lets the synchronous require()
 * complete; the import then runs to completion asynchronously and starts
 * the listener inside api-server/index.ts, which keeps the Node event loop
 * alive. The `.catch` preserves crash-on-startup-error semantics — any
 * failure during api-server init is logged and exits the process so
 * Passenger sees a real spawn failure (rather than a silently-broken
 * worker). See optimizer-handoffs/011-npm-ci-server-side-kill.md for the
 * diagnostic trail (Node 22.22.2 → 22.22.3 yum upgrade on 2026-05-21
 * surfaced this; production broke silently the next deploy attempt).
 *
 * Local dev: `node app.js` works the same way as production — same entry
 * path, same env-file loading (inside api-server/index.ts), identical
 * behavior. The `npm run api:dev` script invokes tsx directly on the TS
 * source as a shortcut; this file is the alternative path that mirrors
 * production exactly.
 *
 * Production: `/home/sreardon/apps/portfolio-search/app.js`. cPanel's
 * Passenger picks this up as the Node entrypoint (default startup file is
 * `app.js`). Env vars come from a sibling `.env` file (see api-server/index.ts
 * for why — cPanel's UAPI envvar delivery doesn't reach OSS-Passenger Node
 * children). To swap workers after a code change: `touch tmp/restart.txt`.
 *
 * See `optimizer-handoffs/009-portfolio-search-app-deploy.md` for the brief
 * that established this deploy topology.
 */
import { register } from 'tsx/esm/api';
register();
import('./api-server/index.ts').catch((err) => {
  console.error('[app.js] failed to start api-server:', err);
  process.exit(1);
});
