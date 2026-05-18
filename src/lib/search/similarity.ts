/**
 * Cosine similarity + top-N retrieval over the search index.
 *
 * MiniLM vectors are mean-pooled and L2-normalized at embed time (see
 * `embed.ts`), so cosine collapses to a dot product. We still implement
 * full cosine here for defense-in-depth (catches any non-normalized vector
 * sneaking in from a future model change without surfacing as garbage).
 *
 * The v1 corpus is small (~10–20 entries). Linear scan is sub-millisecond
 * and beats indexing structure overhead. If the corpus ever exceeds ~10k
 * entries, revisit with HNSW or product quantization.
 */
import type { SearchIndexEntry, SearchResult } from './types.ts';

/**
 * Cosine similarity between two equal-length vectors. Returns NaN if either
 * vector is zero-length or all-zeros (avoid the divide-by-zero rather than
 * silently returning 0 — surfaces an upstream bug clearly).
 */
export function cosine(a: number[] | Float32Array, b: number[] | Float32Array): number {
  if (a.length !== b.length) {
    throw new Error(`cosine: dim mismatch (a=${a.length}, b=${b.length})`);
  }
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    const av = a[i];
    const bv = b[i];
    dot += av * bv;
    normA += av * av;
    normB += bv * bv;
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? NaN : dot / denom;
}

/**
 * Score the query vector against every entry and return the top-N by
 * descending score. Stable for ties via the input order (JavaScript's
 * native sort is stable per spec since ES2019).
 *
 * Returns `SearchResult` (the runtime-facing shape) — strips internal fields
 * like `hash`, `vector`, `sourcePath` that the client doesn't need.
 */
export function topN(
  query: number[] | Float32Array,
  entries: readonly SearchIndexEntry[],
  n: number,
): SearchResult[] {
  const scored = entries.map((e) => ({
    id: e.id,
    title: e.title,
    url: e.url,
    snippet: e.snippet,
    score: cosine(query, e.vector),
  }));
  // Filter NaN scores defensively — a malformed entry shouldn't poison the result list.
  const valid = scored.filter((r) => !Number.isNaN(r.score));
  valid.sort((a, b) => b.score - a.score);
  return valid.slice(0, n);
}
