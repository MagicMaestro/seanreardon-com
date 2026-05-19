#!/usr/bin/env tsx
/**
 * Standalone Node HTTP server for the v1 AI semantic search endpoint.
 *
 * Run (dev): `npm run api:dev`
 * Deploy: registered as a cPanel Application Manager Node app at
 *         /home/sreardon/apps/portfolio-search/ with base_uri=/api/search,
 *         per `optimizer-handoffs/008-node-app-memory-ceiling.md` hand-back.
 *         Apache reverse-proxies /api/* to this app's port via Passenger.
 *
 * Architecture deviation note (2026-05-18): the foundation plan's repo tree
 * suggests `src/pages/api/search.ts` (Astro endpoint), which would require
 * switching the site to `output: 'server'` + per-page `prerender = true` on
 * all ~12 existing pages + updating the build + deploy flow. That's a much
 * larger refactor than this endpoint warrants. The standalone Node app
 * (this file) is the smaller scope, matches the cPanel Application Manager
 * deployment topology the optimizer brief 008 set up, and keeps the static
 * site purely static for the existing SSH-rsync-to-public_html flow. The
 * `src/pages/api/` path stays available as a future migration target if the
 * cost-benefit ever shifts.
 *
 * Behavior per `decisions/ai-features-v1.md` Phase 2:
 *   1. Cold-load the search index into memory on first request (cached).
 *   2. Cold-load MiniLM (via src/lib/search/embed.ts singleton).
 *   3. Embed query, cosine similarity vs all vectors, return top N=10.
 *   4. Per-IP rate limit: 30 queries/minute (in-memory counter).
 *   5. Aggregated logging per decision 8 — query + results_count +
 *      top_result_id + hour-truncated timestamp. NO IP, NO session,
 *      NO user identifier.
 *
 * The decision-8 rule "no IP retained" applies to the LOG ONLY. The rate
 * limiter must use the IP at request time to enforce per-IP limits, but it
 * holds the IP in a process-local Map that resets per restart and never
 * touches durable storage.
 */

import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { appendFile, mkdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { embed } from '../src/lib/search/embed.ts';
import { topN } from '../src/lib/search/similarity.ts';
import type { SearchIndex } from '../src/lib/search/types.ts';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const REPO_ROOT = fileURLToPath(new URL('../', import.meta.url));

/** Env-overridable path to the search index artifact. Dev default points at
 *  the repo's public/. Production deploy sets SEARCH_INDEX_PATH to wherever
 *  the deploy script copied the file inside the app's directory. */
const INDEX_PATH = process.env.SEARCH_INDEX_PATH ?? join(REPO_ROOT, 'public', 'search-index.json');

/** Where aggregated query logs land. Daily files: queries-YYYY-MM-DD.jsonl.
 *  Dev default is repo-local; production sets API_LOG_DIR explicitly. The
 *  `logs/` directory under the repo is gitignored. */
const LOG_DIR = process.env.API_LOG_DIR ?? join(REPO_ROOT, 'logs');

const PORT = Number(process.env.PORT) || 3001;
/** Bind host. `127.0.0.1` (loopback only) by default — no LAN exposure, no
 *  Windows Firewall prompt on dev start, and it matches the production
 *  posture: cPanel Passenger reverse-proxies from Apache to localhost:PORT
 *  on the same host, so the app never needs to listen on other interfaces.
 *  Override via HOST env var if a specific scenario needs it (e.g.,
 *  binding to a Docker network on a future containerized deploy). */
const HOST = process.env.HOST || '127.0.0.1';
const TOP_N = 10;
const RATE_LIMIT_PER_MIN = 30;
const RATE_WINDOW_MS = 60 * 1000;
const MAX_QUERY_LENGTH = 500;

// ---------------------------------------------------------------------------
// Index loader (lazy, process-lifetime cache)
// ---------------------------------------------------------------------------

let indexPromise: Promise<SearchIndex> | null = null;

/**
 * Lazy index loader. First call kicks off the read; subsequent calls
 * receive the same in-flight promise (so concurrent first-requests don't
 * race two separate file reads). Cached for process lifetime.
 */
async function getIndex(): Promise<SearchIndex> {
  if (!indexPromise) {
    indexPromise = (async () => {
      const raw = await readFile(INDEX_PATH, 'utf8');
      const idx = JSON.parse(raw) as SearchIndex;
      console.log(`[api-server] loaded index: ${idx.entries.length} entries, model=${idx.model}, built ${idx.builtAt}`);
      return idx;
    })();
  }
  return indexPromise;
}

// ---------------------------------------------------------------------------
// Rate limiter (per-IP, in-memory)
// ---------------------------------------------------------------------------

interface RateEntry {
  count: number;
  windowStart: number;
}

const rateState = new Map<string, RateEntry>();

/**
 * Sliding-window-ish rate limiter: each IP gets a counter that resets
 * RATE_WINDOW_MS after the first request in the current window. Returns
 * true if the request is allowed, false if it should be rejected with 429.
 *
 * In-memory by design — decision 4 specifies "30 q/min, in-memory counter,
 * no Redis for v1." The Map resets when the process restarts. With a single
 * Passenger worker (PassengerMaxInstances 1 per the optimizer hand-back),
 * there's no cross-worker rate-limit leakage to worry about.
 *
 * NB: the IP is held ONLY in this Map. It's never written to disk, never
 * logged, never persisted. Decision 8 ("no IP retained") applies to the
 * durable log, not to the in-process rate counter.
 */
function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateState.get(ip);
  if (!entry || now - entry.windowStart >= RATE_WINDOW_MS) {
    rateState.set(ip, { count: 1, windowStart: now });
    return true;
  }
  if (entry.count >= RATE_LIMIT_PER_MIN) return false;
  entry.count++;
  return true;
}

/**
 * Periodic GC of expired rate-limit entries. Without this, the Map would
 * grow unboundedly over the process's lifetime as new IPs come in. Run
 * every 5 minutes; a Map of 10k entries is fine, but unbounded growth is
 * a slow leak.
 */
setInterval(
  () => {
    const now = Date.now();
    for (const [ip, entry] of rateState) {
      if (now - entry.windowStart >= RATE_WINDOW_MS) rateState.delete(ip);
    }
  },
  5 * 60 * 1000,
).unref();

// ---------------------------------------------------------------------------
// Aggregated logging (decision 8)
// ---------------------------------------------------------------------------

interface QueryLogEntry {
  query: string;
  results_count: number;
  top_result_id: string | null;
  timestamp_truncated_to_hour: string;
}

/**
 * Append a query log entry to the daily JSONL file. NO IP, NO session, NO
 * user identifier — that's the whole point of decision 8. The format is
 * one JSON object per line so the file can be tail-read or grep'd without
 * a full parse.
 */
async function logQuery(entry: QueryLogEntry): Promise<void> {
  await mkdir(LOG_DIR, { recursive: true });
  const date = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const logPath = join(LOG_DIR, `queries-${date}.jsonl`);
  await appendFile(logPath, JSON.stringify(entry) + '\n', 'utf8');
}

/** Truncate now to the start of the current hour, ISO-format. Removes
 *  minute/second/millisecond resolution that could otherwise correlate
 *  log entries with individual visitor sessions. */
function truncatedHour(): string {
  const d = new Date();
  d.setUTCMinutes(0, 0, 0);
  return d.toISOString();
}

// ---------------------------------------------------------------------------
// Request utilities
// ---------------------------------------------------------------------------

/**
 * Resolve the client IP. Behind Apache + Passenger (production), the real
 * IP arrives via `x-forwarded-for` — take the FIRST entry (leftmost is the
 * original client; subsequent entries are intermediate proxies). In dev,
 * fall back to the socket's remote address.
 *
 * Security caveat: x-forwarded-for is trivially spoofable if the server is
 * exposed without a trusted proxy in front. In our deploy, Apache always
 * sets the header from the real socket, overriding any client-supplied
 * value — so trusting the leftmost is correct. Don't expose this server
 * directly to the public internet without that guard.
 */
function getClientIp(req: IncomingMessage): string {
  const xff = req.headers['x-forwarded-for'];
  if (typeof xff === 'string' && xff.length > 0) {
    const first = xff.split(',')[0].trim();
    if (first) return first;
  }
  return req.socket.remoteAddress ?? 'unknown';
}

/**
 * Parse a JSON request body. Caps at 4KB to prevent abuse — search queries
 * never need more, and the MAX_QUERY_LENGTH check below rejects long ones
 * anyway, but we want to bail before allocating large buffers.
 */
async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const MAX_BYTES = 4 * 1024;
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let total = 0;
    req.on('data', (chunk: Buffer) => {
      total += chunk.length;
      if (total > MAX_BYTES) {
        req.destroy();
        reject(new Error('body too large'));
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      try {
        const text = Buffer.concat(chunks).toString('utf8');
        resolve(text ? JSON.parse(text) : {});
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

/** Send a JSON response with CORS headers. CORS is permissive in dev so a
 *  local Astro dev server can hit this on a different port; production
 *  serves the static site and API from the same origin so CORS is a no-op
 *  anyway. */
function send(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.end(JSON.stringify(body));
}

// ---------------------------------------------------------------------------
// Request handler
// ---------------------------------------------------------------------------

/**
 * Accept POST at `/api/search`, `/api/search/`, or `/` (the latter because
 * Apache + Passenger may strip the base_uri prefix when proxying — depends
 * on the reverse-proxy config; handling both keeps us robust to either).
 */
function isSearchRoute(path: string): boolean {
  return path === '/api/search' || path === '/api/search/' || path === '/';
}

const server = createServer(async (req, res) => {
  // CORS preflight — dev convenience; harmless in production.
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.end();
    return;
  }

  const path = (req.url ?? '/').split('?')[0];

  // Health check — useful for the deploy smoke test and the optimizer's
  // weekly digest (per the brief 001 hand-back pattern, if extended).
  if (req.method === 'GET' && path === '/health') {
    send(res, 200, { status: 'ok' });
    return;
  }

  if (req.method !== 'POST' || !isSearchRoute(path)) {
    send(res, 404, { error: 'not found' });
    return;
  }

  // Rate limit — check FIRST, before any work happens.
  const ip = getClientIp(req);
  if (!checkRateLimit(ip)) {
    send(res, 429, { error: 'too many requests' });
    return;
  }

  // Parse body
  let body: unknown;
  try {
    body = await readJsonBody(req);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'invalid json';
    send(res, 400, { error: msg });
    return;
  }

  // Validate query
  const q = (body && typeof body === 'object' && 'q' in body && typeof (body as { q: unknown }).q === 'string')
    ? (body as { q: string }).q.trim()
    : '';
  if (!q) {
    send(res, 400, { error: 'q (string) is required' });
    return;
  }
  if (q.length > MAX_QUERY_LENGTH) {
    send(res, 400, { error: `q too long (max ${MAX_QUERY_LENGTH} chars)` });
    return;
  }

  // Run search
  const startedAt = Date.now();
  try {
    const index = await getIndex();
    const queryVec = await embed(q);
    const results = topN(queryVec, index.entries, TOP_N);
    const tookMs = Date.now() - startedAt;

    // Fire-and-forget logging — don't await; the response shouldn't block
    // on disk I/O. Any failure goes to stderr and the response still ships.
    logQuery({
      query: q,
      results_count: results.length,
      top_result_id: results[0]?.id ?? null,
      timestamp_truncated_to_hour: truncatedHour(),
    }).catch((err) => console.error('[api-server] log write failed:', err));

    send(res, 200, { results, took_ms: tookMs });
  } catch (err) {
    console.error('[api-server] search failed:', err);
    send(res, 500, { error: 'internal error' });
  }
});

// ---------------------------------------------------------------------------
// Startup
// ---------------------------------------------------------------------------

server.listen(PORT, HOST, () => {
  console.log(`[api-server] listening on http://${HOST}:${PORT}`);
  console.log(`[api-server] index path: ${INDEX_PATH}`);
  console.log(`[api-server] log dir: ${LOG_DIR}`);
  console.log(`[api-server] try: curl -X POST -H "Content-Type: application/json" -d '{"q":"AI integration"}' http://localhost:${PORT}/api/search`);
});

// Graceful shutdown — keeps in-flight requests from getting cut off on
// process termination. cPanel Application Manager / Passenger sends SIGTERM
// when restarting the app.
function shutdown(signal: string) {
  console.log(`[api-server] received ${signal}, shutting down`);
  server.close((err) => {
    if (err) {
      console.error('[api-server] error during shutdown:', err);
      process.exit(1);
    }
    process.exit(0);
  });
  // Force-exit if graceful shutdown takes too long.
  setTimeout(() => {
    console.error('[api-server] shutdown timed out, force-exiting');
    process.exit(1);
  }, 10_000).unref();
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
