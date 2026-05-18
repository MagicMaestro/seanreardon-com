#!/usr/bin/env tsx
/**
 * Verification CLI for the v1 semantic search index.
 *
 * Run: `npm run search:query -- "your query here"`
 *
 * Loads `public/search-index.json`, embeds the query via MiniLM, and prints
 * the top 5 results by cosine similarity. The point is to canary "does
 * retrieval actually work" before any UI is wired up — if results look
 * obviously off (a query for "AI" returns the privacy policy as #1), the
 * problem is in the corpus / chunker / model choice, not the UI.
 *
 * Phase 1 deliverable per decisions/ai-features-v1.md ("Verification CLI:
 * small script that takes a query, runs cosine similarity, prints top 5 —
 * canary for 'does retrieval actually work' before any UI is built").
 */

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { embed } from '../src/lib/search/embed.ts';
import { topN } from '../src/lib/search/similarity.ts';
import type { SearchIndex } from '../src/lib/search/types.ts';

const REPO_ROOT = fileURLToPath(new URL('../', import.meta.url));
const INDEX_PATH = join(REPO_ROOT, 'public', 'search-index.json');
const TOP_N = 5;

async function main() {
  // `--` in npm scripts splits args; positional query may live in argv[2..]
  const query = process.argv.slice(2).join(' ').trim();
  if (!query) {
    console.error('Usage: npm run search:query -- "your query here"');
    process.exit(1);
  }

  const raw = await readFile(INDEX_PATH, 'utf8');
  const index = JSON.parse(raw) as SearchIndex;
  console.log(`Index: ${index.entries.length} entries, model=${index.model}, built ${index.builtAt}`);
  console.log(`Query: "${query}"\n`);

  const t0 = Date.now();
  const queryVec = await embed(query);
  const embedMs = Date.now() - t0;

  const t1 = Date.now();
  const results = topN(queryVec, index.entries, TOP_N);
  const scanMs = Date.now() - t1;

  console.log(`Embed: ${embedMs}ms · Scan: ${scanMs}ms\n`);
  if (results.length === 0) {
    console.log('No results.');
    return;
  }
  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    console.log(`${i + 1}. [${r.score.toFixed(4)}] ${r.title}`);
    console.log(`   ${r.url}`);
    console.log(`   ${r.snippet}\n`);
  }
}

main().catch((err) => {
  console.error('search-cli failed:', err);
  process.exit(1);
});
