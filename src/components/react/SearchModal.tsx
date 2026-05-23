/* ============================================================================
   SearchModal — React island for the AI semantic search modal
   ============================================================================
   Phase 3 §3 of decisions/ai-features-v1.md. Rendered as a child of the
   SteamTransition island (which owns the open/close phase machine). The
   modal fades in AFTER the fog grows to full size (~3500ms post-click)
   and fades out alongside the fog when closing.

   Per the decision spec:
     - 300ms debounced input → POST /api/search { q } → results
     - Results: title + ~150-char snippet (with match highlighting,
       iter 3) + small "from /lessons-learned/post-slug" path indicator
     - Loading state shows only AFTER 200ms of waiting (avoid flashing
       on fast queries — most queries return in ~50ms)
     - Empty state: 3 curated picks (iter 2 — passed in as `curatedPicks`
       prop from BaseLayout)
     - No-results state: "No matches for 'X'. Try broader terms, or
       browse [recent posts]."
     - Keyboard nav (↑/↓/Enter/Esc): iter 3 (= task #5)

   Click handling: the modal content `stopPropagation()`s clicks so they
   don't bubble up to SteamTransition's overlay click handler (which
   would close the fog). Clicks on the SteamTransition's surrounding
   area (the fog overlay outside the modal) still close — that's the
   "click anywhere in the fog to close" behavior from Sean iter 13.

   API endpoint: /api/search (POST). On production, Apache reverse-proxies
   /api/* to the Node app via cPanel Application Manager. In `npm run dev`
   the api-server needs to be running separately (`npm run api:dev`); the
   modal will show a request error if the server isn't reachable. */

import { useEffect, useRef, useState } from 'react';
import './SearchModal.css';

/** Matches SearchResult in src/lib/search/types.ts. Duplicated here to
   avoid a cross-package import dependency in the React island bundle —
   the structural shape is small and stable. */
interface SearchResult {
  id: string;
  title: string;
  url: string;
  snippet: string;
  score: number;
}

/** Curated picks share the visible fields with SearchResult (id, title,
   url, snippet) so the empty state can render via the same UI, but lack
   the `score` field — they're not from a search, they're hand-picked
   suggestions. */
interface CuratedPick {
  id: string;
  title: string;
  url: string;
  snippet: string;
}

interface Props {
  /** Phase state machine value from the parent SteamTransition.
     - 'idle': modal hidden, not rendered
     - 'active': fog opening; modal fades in after the 3500ms fog-grown delay
     - 'closing': fog dissipating; modal fades out in lockstep */
  phase: 'idle' | 'active' | 'closing';
  /** Curated picks for the empty state — three suggestions shown before
     the user types anything. Resolved at build time in BaseLayout from
     content collections (writing + work) per decisions/002 §6: post 010
     + redesign project + latest published post. Default empty falls
     back to a placeholder message. */
  curatedPicks?: CuratedPick[];
}

/** Delay from phase='active' (= click) to the modal starting its fade-in.
   Matches the time the fog needs to fully grow (per SPR-0050 timing scale):
   fog delay 1370ms + fog duration 2130ms = 3500ms. The modal materializes
   AS THE FOG SETTLES, per decisions/002 §4 ("the search modal materializes
   through the steam as it dissipates"). */
const MODAL_FADE_IN_DELAY_MS = 3500;

/** Loading state appears only after 200ms of an in-flight request. For
   queries that return faster (typical case), the loading state never
   shows and the user sees results directly. Per Phase 3 §3 of the
   decisions doc: "loading state after 200ms only (avoid flashing on
   fast queries)." */
const LOADING_THRESHOLD_MS = 200;

/** Debounce delay on input changes. 300ms matches the standing UX value
   used elsewhere (Pagefind dropdown debounce, decisions doc §3 spec). */
const INPUT_DEBOUNCE_MS = 300;

export default function SearchModal({ phase, curatedPicks = [] }: Props) {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /* `isVisible` controls the modal's opacity transition. Set true ~3500ms
     after phase becomes 'active' (giving the fog time to grow first).
     Reset to false when phase changes away from 'active' (close path). */
  const [isVisible, setIsVisible] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  /* Phase → isVisible bridge. When phase becomes 'active', wait for the
     fog to grow, then show the modal. When phase changes away, hide
     immediately so the closing fade-out fires. */
  useEffect(() => {
    if (phase === 'active') {
      const t = window.setTimeout(() => {
        setIsVisible(true);
        /* Auto-focus the input as it becomes visible. Done after the
           visibility flag flips so the focus call lands AFTER the input
           is rendered as interactive. */
        if (inputRef.current) inputRef.current.focus();
      }, MODAL_FADE_IN_DELAY_MS);
      return () => window.clearTimeout(t);
    } else {
      setIsVisible(false);
      /* Reset query state when modal closes. Sean direction iter 1: this
         is conventional modal behavior — re-opening starts fresh rather
         than restoring the last query. If a "remember last query" feature
         is wanted later, store query in sessionStorage and restore on
         visibility. */
      if (phase === 'idle') {
        setQuery('');
        setDebouncedQuery('');
        setResults(null);
        setError(null);
      }
    }
  }, [phase]);

  /* Debounce the query — only push to debouncedQuery after 300ms of no
     further keystrokes. The search effect below watches debouncedQuery,
     so it only fires after the user pauses typing. */
  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedQuery(query), INPUT_DEBOUNCE_MS);
    return () => window.clearTimeout(t);
  }, [query]);

  /* Run the search when debouncedQuery changes. Empty query → clear
     results (back to empty state). Otherwise POST to /api/search. The
     loading state appears only if the request takes >200ms; sub-200ms
     responses go straight to results with no flash. */
  useEffect(() => {
    const trimmed = debouncedQuery.trim();
    if (!trimmed) {
      setResults(null);
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    /* Schedule the loading state for 200ms from now. If the request
       finishes faster, we'll cancel this timer below and never show
       loading. */
    const loadingTimer = window.setTimeout(() => {
      if (!cancelled) setLoading(true);
    }, LOADING_THRESHOLD_MS);

    /* Fire-and-await the search. The relative URL /api/search resolves
       to the cPanel Application Manager Node app on production (via
       Apache reverse-proxy); in dev, requires `npm run api:dev` to be
       running on the configured port. */
    fetch('/api/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ q: trimmed }),
    })
      .then((res) => {
        if (!res.ok) throw new Error(`Search request failed: ${res.status}`);
        return res.json() as Promise<{ results: SearchResult[]; took_ms: number }>;
      })
      .then((data) => {
        if (cancelled) return;
        setResults(data.results);
        setLoading(false);
        setError(null);
      })
      .catch((err) => {
        if (cancelled) return;
        console.warn('[SearchModal] request failed:', err);
        setResults([]);
        setLoading(false);
        setError(err instanceof Error ? err.message : 'Search failed');
      })
      .finally(() => {
        window.clearTimeout(loadingTimer);
      });

    return () => {
      cancelled = true;
      window.clearTimeout(loadingTimer);
    };
  }, [debouncedQuery]);

  /* Don't render anything when idle — saves DOM nodes and ensures
     pointer-events doesn't accidentally intercept clicks. */
  if (phase === 'idle') return null;

  /* The path indicator below each result strips the URL down to a
     trailing-component label (e.g., "/lessons-learned/post-slug/"
     becomes "from /lessons-learned/post-slug"). Per decisions §10:
     "small 'from /lessons-learned/post-slug' path indicator." */
  const formatPath = (url: string): string => {
    try {
      const u = new URL(url, window.location.origin);
      const path = u.pathname.replace(/\/$/, '');
      return path ? `from ${path}` : '';
    } catch {
      return url;
    }
  };

  return (
    <div
      className={`search-modal${isVisible ? ' is-visible' : ''}`}
      aria-hidden={!isVisible}
      role="dialog"
      aria-label="AI search"
      /* Stop click propagation so clicks inside the modal don't bubble
         to SteamTransition's overlay handler (which would close the
         fog). The exception is the outer .search-modal element itself;
         clicks on its padding (between the modal-content box and the
         viewport edges) DO bubble — that's the "click outside modal
         to close" behavior. The inner .search-modal-content stops
         propagation explicitly via its own handler below. */
    >
      <div
        className="search-modal-content"
        onClick={(e) => e.stopPropagation()}
      >
        <form
          className="search-modal-form"
          onSubmit={(e) => e.preventDefault()}
          role="search"
        >
          <input
            ref={inputRef}
            type="search"
            className="search-modal-input"
            placeholder="Ask me anything…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoComplete="off"
            aria-label="Search query"
          />
        </form>

        <div className="search-modal-results" aria-live="polite">
          {/* State 1: error (network or server-side) */}
          {error && (
            <p className="search-modal-message">
              <em>Couldn't reach the search server. Try again in a moment.</em>
            </p>
          )}

          {/* State 2: loading (only if request took >200ms) */}
          {loading && !error && (
            <p className="search-modal-message">
              <em>Searching…</em>
            </p>
          )}

          {/* State 3: empty state — no query yet. Renders the three
              curated picks (post 010 + redesign project + latest writing
              post, computed at build time in BaseLayout). Reuses the
              same .search-modal-result-* classes as actual results, with
              a small mono-caps label so the user knows these are
              suggestions, not search hits. If curatedPicks is empty
              (build-time collection failure), falls back to a hint
              message. */}
          {!loading && !error && results === null && (
            <div className="search-modal-empty">
              {curatedPicks.length > 0 ? (
                <>
                  <p className="search-modal-empty-label">Suggested</p>
                  <ul className="search-modal-result-list">
                    {curatedPicks.map((pick) => (
                      <li key={pick.id} className="search-modal-result-item">
                        <a href={pick.url} className="search-modal-result-link">
                          <h3 className="search-modal-result-title">{pick.title}</h3>
                          <p className="search-modal-result-snippet">{pick.snippet}</p>
                          <span className="search-modal-result-path">{formatPath(pick.url)}</span>
                        </a>
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <p>Start typing to search across writing and reference pages.</p>
              )}
            </div>
          )}

          {/* State 4: no results for query */}
          {!loading && !error && results !== null && results.length === 0 && debouncedQuery && (
            <p className="search-modal-message">
              No matches for <strong>"{debouncedQuery}"</strong>. Try broader terms,
              or browse <a href="/lessons-learned/">recent posts</a>.
            </p>
          )}

          {/* State 5: results */}
          {!loading && !error && results !== null && results.length > 0 && (
            <ul className="search-modal-result-list">
              {results.map((r) => (
                <li key={r.id} className="search-modal-result-item">
                  <a href={r.url} className="search-modal-result-link">
                    <h3 className="search-modal-result-title">{r.title}</h3>
                    <p className="search-modal-result-snippet">{r.snippet}</p>
                    <span className="search-modal-result-path">{formatPath(r.url)}</span>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
