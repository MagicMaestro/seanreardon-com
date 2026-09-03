/**
 * Corpus loader + plain-text extraction for the v1 search index.
 *
 * Sources per `decisions/ai-features-v1.md` decision 9:
 *   - `src/content/writing/*.mdx` filtered to `status === 'published'`
 *   - About/static pages: `about-me.astro`, `privacy/index.astro` (substantive
 *     content; index/listing/utility pages are explicitly excluded — they
 *     don't carry retrievable content of their own)
 *
 * Explicitly NOT in the v1 search corpus (per the same decision):
 *   - `src/content/work/*` — work entries are short metadata-heavy stubs
 *   - The redesign conversation log — joins the CHAT corpus at v1.1
 *   - `post-ideas/`, `optimizer-handoffs/`, `decisions/` — internal planning
 *   - The photography site — separate site, separate index when it ships
 *
 * Chunking strategy (decision 9): ONE chunk per source file. The v1 corpus
 * is small and posts are short (≤700 words). MiniLM tokenizer caps at ~256
 * tokens internally, so the first ~200 words of each post drive the embedding
 * regardless. Title + summary + lede do most of the retrieval work; fine-
 * grained chunking is deferred until corpus size or post length forces it.
 */

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { SearchDoc } from './types.ts';

/** Repo root, computed from this file's location. */
const REPO_ROOT = fileURLToPath(new URL('../../../', import.meta.url));

// ---------------------------------------------------------------------------
// Frontmatter + MDX/Astro stripping
// ---------------------------------------------------------------------------

/**
 * Parse YAML-ish frontmatter (the `--- ... ---` block at the top of MDX files).
 * Minimal parser — only handles the keys we care about (title, summary, status).
 * We're not building a general YAML parser; if frontmatter gains complex
 * structures later, swap in `yaml` package.
 */
interface Frontmatter {
  title?: string;
  summary?: string;
  status?: string;
  date?: string;
  tags?: string[];
}

function parseFrontmatter(src: string): { fm: Frontmatter; body: string } {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(src);
  if (!match) return { fm: {}, body: src };
  const fm: Frontmatter = {};
  for (const line of match[1].split(/\r?\n/)) {
    const kv = /^(\w+):\s*(.*)$/.exec(line);
    if (!kv) continue;
    const key = kv[1];
    let value = kv[2].trim();
    // Strip surrounding quotes
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    // Tags as inline array `[a, b, c]` — minimal handler
    if (key === 'tags' && value.startsWith('[') && value.endsWith(']')) {
      fm.tags = value
        .slice(1, -1)
        .split(',')
        .map((t) => t.trim().replace(/^["']|["']$/g, ''))
        .filter(Boolean);
    } else if (key === 'title' || key === 'summary' || key === 'status' || key === 'date') {
      fm[key] = value;
    }
  }
  return { fm, body: src.slice(match[0].length) };
}

/**
 * Strip MDX-specific syntax from a post body to produce plain prose for
 * embedding. Not a full MDX parser — a pragmatic regex pipeline tuned for
 * what our posts actually contain:
 *
 *   - `import ... from '...';` lines (removed entirely)
 *   - `<Component foo="bar">…</Component>` (tags removed, inner text kept)
 *   - Self-closing `<Component />` (removed)
 *   - Markdown link `[text](url)` → `text`
 *   - Markdown image `![alt](url)` → `alt`
 *   - Inline code, bold, italic, headings — strip the marker, keep the text
 *   - Code fences ```lang … ``` — drop entirely (code prose isn't useful
 *     retrieval signal for our posts and adds noise to embeddings)
 *   - HTML comments `<!-- ... -->` — drop
 *
 * The output is collapsed-whitespace plain text ready for the embedder.
 */
function stripMdx(body: string): string {
  return (
    body
      // HTML comments
      .replace(/<!--[\s\S]*?-->/g, '')
      // import lines at top of file
      .replace(/^\s*import\s+[^;]+;?\s*$/gm, '')
      // Code fences (```lang\n...\n```)
      .replace(/```[\s\S]*?```/g, '')
      // Inline code `code`
      .replace(/`([^`]+)`/g, '$1')
      // Markdown images ![alt](url) → alt
      .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
      // Markdown links [text](url) → text
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      // Bold **text** / __text__
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/__([^_]+)__/g, '$1')
      // Italic *text* / _text_
      .replace(/\*([^*]+)\*/g, '$1')
      .replace(/_([^_]+)_/g, '$1')
      // ATX headings — drop the leading #'s
      .replace(/^#{1,6}\s+/gm, '')
      // Strip JSX self-closing tags entirely
      .replace(/<[A-Za-z][^>]*\/>/g, '')
      // Strip JSX/HTML open + close tags, keep inner text
      .replace(/<\/?[A-Za-z][^>]*>/g, '')
      // Collapse whitespace
      .replace(/\s+/g, ' ')
      .trim()
  );
}

/**
 * Strip Astro template syntax for static-page extraction. Astro pages are
 * front-matter (between `---`) plus HTML-like template with `{expression}`
 * interpolations. Approach:
 *
 *   - Drop the frontmatter block entirely (it's component logic, not content)
 *   - Drop import/export/const lines that snuck past the frontmatter (defensive)
 *   - Drop `{expression}` interpolations (we don't evaluate JS at index time)
 *   - Drop `{/* ... *\/}` JSX-style comments
 *   - Strip HTML tags, keep inner text
 *   - Collapse whitespace
 *
 * Like stripMdx, this is pragmatic-not-exhaustive. If a future static page
 * uses heavy dynamic content, revisit.
 */
function stripAstro(src: string): string {
  // Drop the frontmatter block (--- ... ---) at the top
  const fmMatch = /^---\r?\n[\s\S]*?\r?\n---\r?\n?/.exec(src);
  let body = fmMatch ? src.slice(fmMatch[0].length) : src;
  body = body
    // JSX-style comments {/* ... */}
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    // HTML comments
    .replace(/<!--[\s\S]*?-->/g, '')
    // {expression} interpolations (greedy match for single-line expressions)
    .replace(/\{[^{}]*\}/g, '')
    // HTML tags
    .replace(/<\/?[A-Za-z][^>]*>/g, ' ')
    // Collapse whitespace
    .replace(/\s+/g, ' ')
    .trim();
  return body;
}

/**
 * Build a ~150-char snippet from extracted text. Cuts at a word boundary
 * when possible and appends an ellipsis. Used for the search-result display
 * line under each title.
 */
function buildSnippet(text: string, maxLen = 150): string {
  if (text.length <= maxLen) return text;
  const cut = text.slice(0, maxLen);
  const lastSpace = cut.lastIndexOf(' ');
  const truncated = lastSpace > maxLen * 0.6 ? cut.slice(0, lastSpace) : cut;
  return `${truncated.trim()}…`;
}

// ---------------------------------------------------------------------------
// Public loaders
// ---------------------------------------------------------------------------

/**
 * Load published writing posts from `src/content/writing/*.mdx` and emit
 * one `SearchDoc` per post. URL convention follows the existing routing
 * (`/lessons-learned/<slug>/`) per `src/pages/lessons-learned/[slug].astro`.
 *
 * Glob is done via `fs.readdir` rather than Astro's `getCollection` to keep
 * this module usable from build-time scripts that don't have the Astro
 * runtime available. Trade-off: we re-parse frontmatter here instead of
 * relying on Astro's typed collection layer, but the schema is small.
 */
export async function loadWritingPosts(): Promise<SearchDoc[]> {
  const { readdir } = await import('node:fs/promises');
  const dir = join(REPO_ROOT, 'src/content/writing');
  const files = await readdir(dir);
  const docs: SearchDoc[] = [];
  for (const file of files) {
    if (!file.endsWith('.mdx')) continue;
    const slug = file.replace(/\.mdx$/, '');
    const fullPath = join(dir, file);
    const raw = await readFile(fullPath, 'utf8');
    const { fm, body } = parseFrontmatter(raw);
    if (fm.status !== 'published') continue;
    const stripped = stripMdx(body);
    // Embed: title + summary + body. Title and summary repeated up front
    // give heavy weight to the doc's stated focus — small docs benefit
    // from this lede-emphasis pattern at embed time.
    const text = [fm.title ?? '', fm.summary ?? '', stripped].filter(Boolean).join('\n\n');
    docs.push({
      id: `writing:${slug}`,
      source: 'writing',
      sourcePath: `src/content/writing/${file}`,
      title: fm.title ?? slug,
      url: `/lessons-learned/${slug}/`,
      snippet: buildSnippet(fm.summary ?? stripped),
      text,
    });
  }
  return docs;
}

/**
 * Curated list of static pages whose substantive content is worth indexing.
 * Page index / listing / utility pages are deliberately excluded — they
 * don't carry content of their own (they render summaries of their items).
 *
 * If a new substantive static page lands (e.g., a future `/colophon` or
 * `/uses`), add its entry here. The path is relative to `src/pages/`; the
 * `title` is the human-facing page title; the `url` is the routed URL.
 */
const STATIC_PAGES: Array<{ path: string; title: string; url: string; id: string }> = [
  {
    id: 'static-page:about-me',
    path: 'about-me.astro',
    title: 'About Me',
    url: '/about-me/',
  },
  {
    id: 'static-page:privacy',
    path: 'privacy/index.astro',
    title: 'Privacy Policy',
    url: '/privacy/',
  },
  {
    id: 'static-page:lab-semantic-search',
    path: 'lab/semantic-search.astro',
    title: 'Semantic Search',
    url: '/lab/semantic-search/',
  },
  {
    /* Only the page's static prose is indexed. The question bank lives in
       public/data/ and is fetched client-side, so it never reaches the
       chunker — which is the intent. (SPR-0092) */
    id: 'static-page:real-estate-practice',
    path: 'real-estate-practice.astro',
    title: 'Real Estate Practice Exam',
    url: '/real-estate-practice/',
  },
];

/**
 * Load curated static pages and emit one `SearchDoc` per page. Stripping
 * is done via `stripAstro` which is tuned for our pages' template patterns
 * (HTML-heavy with light Astro interpolation).
 */
export async function loadStaticPages(): Promise<SearchDoc[]> {
  const docs: SearchDoc[] = [];
  for (const entry of STATIC_PAGES) {
    const fullPath = join(REPO_ROOT, 'src/pages', entry.path);
    const raw = await readFile(fullPath, 'utf8');
    const stripped = stripAstro(raw);
    const text = [entry.title, stripped].filter(Boolean).join('\n\n');
    docs.push({
      id: entry.id,
      source: 'static-page',
      sourcePath: `src/pages/${entry.path}`,
      title: entry.title,
      url: entry.url,
      snippet: buildSnippet(stripped),
      text,
    });
  }
  return docs;
}

/**
 * Combined corpus loader. The build-time indexer's entry point for "give
 * me everything that needs to be embedded for v1."
 */
export async function loadCorpus(): Promise<SearchDoc[]> {
  const [writing, staticPages] = await Promise.all([loadWritingPosts(), loadStaticPages()]);
  return [...writing, ...staticPages];
}
