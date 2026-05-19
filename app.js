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
await import('./api-server/index.ts');
