/**
 * Type definitions for the semantic search index.
 *
 * Authoritative shape spec lives in `decisions/ai-features-v1.md` (planning
 * project). The index is built at site build time by `scripts/build-search-index.ts`,
 * committed to the repo as `public/search-index.json` (~200KB target), and
 * consumed at runtime by the `/api/search` endpoint (Phase 2) plus the
 * verification CLI in `scripts/search-cli.ts`.
 *
 * Two-corpus design: this file's `SearchIndex` is the v1 SEARCH corpus
 * (published-content only — committed). The v1.1 CHAT corpus uses a separate
 * type (added when chat ships) because it includes the redesign conversation
 * log and lives off-tree as a gitignored, deploy-time artifact.
 */

/** Source kind — drives URL construction and chunker dispatch. */
export type DocSource = 'writing' | 'static-page';

/**
 * A document as the chunker emits it — before embedding. The chunker
 * produces one of these per source file (one-chunk-per-post / one-chunk-per-page
 * per decision 9), with plain-text `text` ready to embed.
 */
export interface SearchDoc {
  /** Stable id for cache lookup. Format: `<source>:<slug-or-path>`. */
  id: string;
  /** `writing` for content collection posts, `static-page` for hand-curated pages. */
  source: DocSource;
  /** Filesystem path the doc was loaded from (debug + provenance). */
  sourcePath: string;
  /** Display title — from frontmatter for posts, from `<title>` prop / heuristic for pages. */
  title: string;
  /** Public URL the search result links to. */
  url: string;
  /** ~150-char human-readable preview shown in search results. */
  snippet: string;
  /** Plain-text body, ready for the embedder. Markdown / JSX / HTML already stripped. */
  text: string;
}

/**
 * A document AFTER embedding — what gets serialized into `search-index.json`.
 * The `vector` is a 384-dim Float32 (all-MiniLM-L6-v2 output dimension) stored
 * as a plain number array in JSON for portability. `hash` is SHA256 of `text`
 * so the indexer can skip re-embedding unchanged docs across rebuilds.
 */
export interface SearchIndexEntry {
  id: string;
  source: DocSource;
  sourcePath: string;
  title: string;
  url: string;
  snippet: string;
  /** SHA256 of `text` (hex). Drives the incremental-build cache. */
  hash: string;
  /** 384-dim embedding from MiniLM (mean-pooled + normalized). */
  vector: number[];
}

/**
 * The on-disk index artifact. Versioned via `schema` so a future format change
 * can detect-and-rebuild rather than crash. `model` is recorded so a model
 * swap forces a full rebuild even if all hashes match (different model =
 * different vector space, can't reuse old embeddings).
 */
export interface SearchIndex {
  /** Bump on breaking format changes. Current: 1. */
  schema: number;
  /** Identifier for the embedding model used (e.g., `Xenova/all-MiniLM-L6-v2`). */
  model: string;
  /** Embedding dimension; sanity-check value, currently 384 for MiniLM-L6. */
  dim: number;
  /** ISO timestamp of the build that produced this artifact. */
  builtAt: string;
  /** All embedded documents. v1 corpus is small (<20 entries); linear scan is fine. */
  entries: SearchIndexEntry[];
}

/**
 * A single search result returned by the runtime endpoint (and the verify CLI).
 * Score is cosine similarity in [-1, 1]; with normalized MiniLM vectors,
 * practical results are in roughly [0, 1].
 */
export interface SearchResult {
  id: string;
  title: string;
  url: string;
  snippet: string;
  /** Cosine similarity vs the query embedding. Higher = more relevant. */
  score: number;
}
