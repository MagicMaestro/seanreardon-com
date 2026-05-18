#!/usr/bin/env tsx
/**
 * Build-time indexer for the v1 semantic search corpus.
 *
 * Run: `npm run build:search-index`
 *
 * Reads the corpus via `src/lib/search/chunker.ts`, embeds each document
 * with MiniLM via `src/lib/search/embed.ts`, and writes the artifact to
 * `public/search-index.json`. The artifact is committed to the repo (per
 * decision 9 — published-content corpus only, no log) and served by Astro
 * as a static asset alongside the rest of the site build.
 *
 * Incremental builds:
 *
 *   - SHA256 hash each doc's `text` field.
 *   - Load the prior `search-index.json` if present.
 *   - For each current doc: if the hash matches a prior entry AND the model
 *     hasn't changed, reuse the prior `vector` (skip the embed call entirely).
 *   - Otherwise embed fresh.
 *
 * Stable orderings: entries are sorted by `id` before write so the JSON
 * artifact has a deterministic shape — small diffs in git rather than full-
 * file churn whenever a single doc changes.
 *
 * Phase 1 deliverable per decisions/ai-features-v1.md.
 */

import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadCorpus } from '../src/lib/search/chunker.ts';
import { embed, MODEL_ID, EMBED_DIM } from '../src/lib/search/embed.ts';
import type { SearchIndex, SearchIndexEntry } from '../src/lib/search/types.ts';

const REPO_ROOT = fileURLToPath(new URL('../', import.meta.url));
const OUT_PATH = join(REPO_ROOT, 'public', 'search-index.json');
const SCHEMA_VERSION = 1;

function sha256(s: string): string {
  return createHash('sha256').update(s, 'utf8').digest('hex');
}

/**
 * Load the prior index artifact if present. Returns null if missing or
 * unreadable (corrupt JSON, partial write from a previous failed build).
 * Missing/corrupt prior index just forces a full rebuild — not an error.
 */
async function loadPriorIndex(): Promise<SearchIndex | null> {
  if (!existsSync(OUT_PATH)) return null;
  try {
    const raw = await readFile(OUT_PATH, 'utf8');
    const parsed = JSON.parse(raw) as SearchIndex;
    if (parsed.schema !== SCHEMA_VERSION) return null;
    return parsed;
  } catch {
    return null;
  }
}

async function main() {
  const startedAt = Date.now();
  console.log('[build-search-index] loading corpus…');
  const docs = await loadCorpus();
  console.log(`[build-search-index] loaded ${docs.length} docs`);

  if (docs.length === 0) {
    console.warn('[build-search-index] corpus is empty — writing empty index');
  }

  const prior = await loadPriorIndex();
  const priorByHash = new Map<string, SearchIndexEntry>();
  if (prior && prior.model === MODEL_ID && prior.dim === EMBED_DIM) {
    // Same model + same dim — prior vectors are reusable if the hash matches.
    for (const entry of prior.entries) priorByHash.set(entry.hash, entry);
    console.log(`[build-search-index] prior index found (${prior.entries.length} entries, model=${prior.model}) — incremental mode`);
  } else if (prior) {
    console.log(`[build-search-index] prior index uses different model/dim (was ${prior.model}/${prior.dim}, now ${MODEL_ID}/${EMBED_DIM}) — full rebuild`);
  } else {
    console.log('[build-search-index] no prior index — full build');
  }

  const entries: SearchIndexEntry[] = [];
  let embedded = 0;
  let reused = 0;
  for (const doc of docs) {
    const hash = sha256(doc.text);
    const cached = priorByHash.get(hash);
    let vector: number[];
    if (cached && cached.id === doc.id) {
      vector = cached.vector;
      reused++;
    } else {
      process.stdout.write(`[build-search-index] embedding ${doc.id}… `);
      const t0 = Date.now();
      vector = await embed(doc.text);
      process.stdout.write(`${Date.now() - t0}ms\n`);
      embedded++;
    }
    entries.push({
      id: doc.id,
      source: doc.source,
      sourcePath: doc.sourcePath,
      title: doc.title,
      url: doc.url,
      snippet: doc.snippet,
      hash,
      vector,
    });
  }

  // Deterministic order — small git diffs.
  entries.sort((a, b) => a.id.localeCompare(b.id));

  const index: SearchIndex = {
    schema: SCHEMA_VERSION,
    model: MODEL_ID,
    dim: EMBED_DIM,
    builtAt: new Date().toISOString(),
    entries,
  };

  await mkdir(dirname(OUT_PATH), { recursive: true });
  // Two-space indent for human readability; vector arrays still inline.
  await writeFile(OUT_PATH, JSON.stringify(index, null, 2) + '\n', 'utf8');

  const elapsed = ((Date.now() - startedAt) / 1000).toFixed(2);
  const size = (await readFile(OUT_PATH)).byteLength;
  console.log(
    `[build-search-index] wrote ${OUT_PATH} — ${entries.length} entries, ${embedded} embedded, ${reused} reused, ${(size / 1024).toFixed(1)}KB, ${elapsed}s`,
  );
}

main().catch((err) => {
  console.error('[build-search-index] failed:', err);
  process.exit(1);
});
