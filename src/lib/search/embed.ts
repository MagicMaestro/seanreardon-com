/**
 * MiniLM embedding via `@xenova/transformers` (transformers.js Node port).
 *
 * Model: `Xenova/all-MiniLM-L6-v2`. 22M params, 384-dim output, MIT license.
 * ~80MB on disk, ~150MB resident. The library caches the model to
 * `~/.cache/transformers/` on first download — subsequent runs load locally
 * with no network roundtrip.
 *
 * Build-time vs runtime: this same module is used by the build-time indexer
 * (`scripts/build-search-index.ts`, runs on dev/CI) AND by the runtime
 * endpoint (`src/pages/api/search.ts`, runs on the prod Node app at v1).
 * Both code paths lazy-load the pipeline once and cache it for the lifetime
 * of the process — first call is slow (cold model load), subsequent calls
 * are ~50ms. The runtime-side architecture (resident vs child-process-per-query)
 * is pending optimizer-handoff 008's memory-ceiling verdict; this file is
 * agnostic to that choice — same `embed()` signature works either way.
 *
 * Output: 384-dim Float32Array, mean-pooled across tokens and L2-normalized.
 * The normalization at embed time lets the runtime collapse cosine similarity
 * to a dot product (see `similarity.ts`).
 */

import { pipeline, env, type FeatureExtractionPipeline } from '@xenova/transformers';

// Allow remote model downloads (default behavior on first run). If the cache
// is pre-warmed in production, `env.allowRemoteModels = false` can be set
// at deploy time to harden against any unexpected outbound calls.
env.allowRemoteModels = true;

export const MODEL_ID = 'Xenova/all-MiniLM-L6-v2';
export const EMBED_DIM = 384;

/**
 * Cached pipeline instance. The pipeline is heavy to construct (~150MB
 * resident, ~1–3s cold load) so we hold it for the process lifetime.
 * Module-level singleton — every importer of this module shares one model.
 */
let extractorPromise: Promise<FeatureExtractionPipeline> | null = null;

/**
 * Lazy pipeline loader. Idempotent — concurrent callers receive the same
 * in-flight promise rather than each triggering a separate load.
 */
async function getExtractor(): Promise<FeatureExtractionPipeline> {
  if (!extractorPromise) {
    extractorPromise = pipeline('feature-extraction', MODEL_ID) as Promise<FeatureExtractionPipeline>;
  }
  return extractorPromise;
}

/**
 * Embed a single text into a 384-dim vector.
 *
 * Mean-pooled across token embeddings (better for sentence-level similarity
 * than CLS-pooling on MiniLM) and L2-normalized so cosine becomes a dot
 * product downstream. Input is truncated by the tokenizer at ~256 tokens —
 * for our ≤700-word posts that's the first ~200 words. Title + summary +
 * lede carry most of the retrieval signal; truncation is acceptable for v1.
 *
 * Returns a plain `number[]` (not Float32Array) for JSON-serialization
 * downstream. If callers want the typed array, they can wrap manually.
 */
export async function embed(text: string): Promise<number[]> {
  const extractor = await getExtractor();
  const output = await extractor(text, { pooling: 'mean', normalize: true });
  // `output.data` is a Float32Array of length EMBED_DIM. Spread to plain array.
  const vec = Array.from(output.data as Float32Array);
  if (vec.length !== EMBED_DIM) {
    throw new Error(`embed: unexpected vector dim ${vec.length} (expected ${EMBED_DIM})`);
  }
  return vec;
}

/**
 * Batch embed — sequential under the hood (transformers.js does not have a
 * meaningful batch API yet on the Node runtime). Kept as a distinct entry
 * point so the indexer's call sites read clearly and a future parallel
 * implementation lands in one place.
 */
export async function embedMany(texts: readonly string[]): Promise<number[][]> {
  const out: number[][] = [];
  for (const t of texts) {
    out.push(await embed(t));
  }
  return out;
}
