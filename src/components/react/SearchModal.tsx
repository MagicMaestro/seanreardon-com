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

import { useEffect, useRef, useState, type ReactNode } from 'react';
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

/* ============================================================================
   LaserCard wave-animation helpers (replicated from LaserCard.astro)
   ============================================================================
   The Suggested + result cards in the modal use the same proton-beam laser
   treatment as the homepage Recent grid + projects-list cards. That treatment
   lives in `src/components/astro/LaserCard.astro` as an Astro component with
   a scoped <script>, so we can't reuse it directly inside this React island —
   the relevant logic is ported here (CSS rules in SearchModal.css, JS below).

   Sean direction 2026-05-22 iter 4 of SPR-0053: "When hovering over a
   'Suggested' card - or when it's within a certain scroll range/focus like
   we have for mobile screens, the proton beam laser effect should occur
   around the card (this is the same effect used on the recent cards on the
   front page, and the project cards on the client projects page)."

   The wave is two antiphase sine paths traced around the card perimeter,
   with amplitude windowed to zero at corners. On hover/focus/.is-active,
   the SVGs fade in and phase animates via requestAnimationFrame at
   ~4s/cycle — peaks travel around the card. */

const WAVE_AMPLITUDE = 5;
const WAVE_WAVES_PER_EDGE = 4;
const WAVE_PHASE_SPEED = Math.PI / 2; // 4 seconds per full sine cycle

/* ============================================================================
   Match-highlighting helper
   ============================================================================
   Wraps occurrences of the query's tokens in <mark className="search-modal-
   highlight"> spans for visual emphasis in result titles + snippets. Per
   decisions/ai-features-v1.md Phase 3 §3: "title + ~150-char snippet (with
   match highlighting)."

   Semantic search returns results by vector similarity, NOT exact-keyword
   match — so it's expected that some results have ZERO literal token matches
   in their snippet/title. In that case this returns the text unchanged.
   That's correct: a semantic hit on "obsolescence" might surface for the
   query "AI replacing jobs" without any of those words appearing in the
   snippet, and we shouldn't fabricate highlights that aren't actually there.

   Returns React.ReactNode[] (string fragments + <mark> elements) rather than
   raw HTML so React's escaping protects against any XSS surface — the
   snippet field IS plain-text per the chunker contract, but treating it as
   plain-text everywhere is defense in depth.

   Tokenization:
     - Split query on whitespace
     - Filter tokens shorter than 2 chars (skips "a", "I" as single letters
       — common stop-word noise that would highlight half the snippet)
     - Escape regex metacharacters so a query like "C++" or "$state" doesn't
       blow up the RegExp
     - Build a single alternation regex with `gi` flag; use capture group
       so String.prototype.split() returns matched text at odd indices */
function highlightMatches(text: string, query: string): ReactNode[] {
  if (!query || !text) return [text];
  const tokens = query
    .trim()
    .split(/\s+/)
    .filter((t) => t.length >= 2)
    .map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  if (tokens.length === 0) return [text];

  const pattern = new RegExp(`(${tokens.join('|')})`, 'gi');
  const parts = text.split(pattern);

  return parts.map((part, i) => {
    /* String.prototype.split(regex_with_capture_group) interleaves the
       matched text at odd indices with the surrounding text at even
       indices. Empty strings can appear when a match is at the start/end
       or between adjacent matches — render them as-is (renders to nothing
       visible, doesn't break the layout). */
    if (i % 2 === 1) {
      return (
        <mark key={i} className="search-modal-highlight">
          {part}
        </mark>
      );
    }
    return part;
  });
}

function generateWavePath(
  width: number,
  height: number,
  amplitude: number,
  wavesPerEdge: number,
  phase: number,
): string {
  const samplesPerEdge = 60;
  const pts: [number, number][] = [];

  function addEdge(
    startX: number, startY: number,
    dirX: number, dirY: number,
    perpX: number, perpY: number,
    edgeLength: number,
  ): void {
    for (let i = 0; i <= samplesPerEdge; i++) {
      const t = i / samplesPerEdge;
      const win = Math.sin(t * Math.PI);
      const wave = amplitude * win * Math.sin(t * wavesPerEdge * 2 * Math.PI + phase);
      const x = startX + t * edgeLength * dirX + wave * perpX;
      const y = startY + t * edgeLength * dirY + wave * perpY;
      pts.push([x, y]);
    }
  }

  // Four edges clockwise; outward perpendicular at each edge points away
  // from card center.
  addEdge(0, 0, 1, 0, 0, -1, width);            // top
  addEdge(width, 0, 0, 1, 1, 0, height);        // right
  addEdge(width, height, -1, 0, 0, 1, width);   // bottom
  addEdge(0, height, 0, -1, -1, 0, height);     // left

  let d = `M ${pts[0][0].toFixed(2)} ${pts[0][1].toFixed(2)}`;
  for (let j = 1; j < pts.length; j++) {
    d += ` L ${pts[j][0].toFixed(2)} ${pts[j][1].toFixed(2)}`;
  }
  d += ' Z';
  return d;
}

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
  /* Ref for the scrollable results container — passed to the laser-wave
     effect so its IntersectionObserver (touch-primary single-active-card
     logic) scopes to scroll positions inside the modal rather than the
     viewport. */
  const resultsRef = useRef<HTMLDivElement>(null);

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

  /* ============================================================================
     Laser-wave animation effect (mirrors LaserCard.astro's inline <script>)
     ============================================================================
     Re-runs whenever the visible card set changes (curatedPicks shown vs
     search results vs no-results state). Walks every `.search-modal-result-link`
     currently in the DOM and wires up:
       - mouseenter / focusin → start rAF wave animation
       - mouseleave / focusout → stop rAF, render phase=0
       - touch-primary devices: scroll-driven single-active-card via shared
         recompute keyed off scroll inside the results container

     prefers-reduced-motion: paths render once at phase=0 (static); no rAF.
     Effect returns a cleanup function that removes all listeners + cancels
     any in-flight rAF when the card set changes or the modal unmounts. */
  useEffect(() => {
    if (!isVisible) return;
    const container = resultsRef.current;
    if (!container) return;

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const touchPrimary = window.matchMedia('(pointer: coarse)').matches;
    const cards = Array.from(
      container.querySelectorAll<HTMLAnchorElement>('.search-modal-result-link'),
    );
    if (cards.length === 0) return;

    /* Per-card state: rAF id, start timestamp, the cyan + plasma path
       SVG elements (cached so renderPath doesn't re-query). */
    interface CardState {
      el: HTMLAnchorElement;
      cyanPath: SVGPathElement | null;
      plasmaPath: SVGPathElement | null;
      rafId: number | null;
      startTime: number | null;
      start: () => void;
      stop: () => void;
      onMouseEnter: () => void;
      onFocusIn: () => void;
      onMouseLeave: () => void;
      onFocusOut: () => void;
    }

    const states: CardState[] = cards.map((el) => {
      const cyanPath = el.querySelector<SVGPathElement>('.weave-cyan .weave-path');
      const plasmaPath = el.querySelector<SVGPathElement>('.weave-plasma .weave-path');

      const renderPath = (phase: number) => {
        const rect = el.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          if (cyanPath) {
            cyanPath.setAttribute(
              'd',
              generateWavePath(rect.width, rect.height, WAVE_AMPLITUDE, WAVE_WAVES_PER_EDGE, phase),
            );
          }
          if (plasmaPath) {
            plasmaPath.setAttribute(
              'd',
              generateWavePath(
                rect.width,
                rect.height,
                WAVE_AMPLITUDE,
                WAVE_WAVES_PER_EDGE,
                phase + Math.PI,
              ),
            );
          }
        }
      };

      const state: CardState = {
        el,
        cyanPath,
        plasmaPath,
        rafId: null,
        startTime: null,
        start: () => {},
        stop: () => {},
        onMouseEnter: () => {},
        onFocusIn: () => {},
        onMouseLeave: () => {},
        onFocusOut: () => {},
      };

      const renderFrame = (timestamp: number) => {
        if (state.startTime === null) state.startTime = timestamp;
        const elapsed = (timestamp - state.startTime) / 1000;
        const phase = elapsed * WAVE_PHASE_SPEED;
        renderPath(phase);
        state.rafId = requestAnimationFrame(renderFrame);
      };

      state.start = () => {
        if (reducedMotion) return;
        if (state.rafId !== null) return;
        state.startTime = null;
        state.rafId = requestAnimationFrame(renderFrame);
      };
      state.stop = () => {
        if (state.rafId !== null) {
          cancelAnimationFrame(state.rafId);
          state.rafId = null;
        }
        renderPath(0);
      };
      state.onMouseEnter = state.start;
      state.onFocusIn = state.start;
      state.onMouseLeave = state.stop;
      state.onFocusOut = state.stop;

      /* Initial static render so the wave geometry is in place before
         the first interaction (avoids a flicker when the path SVG
         attribute goes from empty to populated on first hover). */
      renderPath(0);

      el.addEventListener('mouseenter', state.onMouseEnter);
      el.addEventListener('focusin', state.onFocusIn);
      el.addEventListener('mouseleave', state.onMouseLeave);
      el.addEventListener('focusout', state.onFocusOut);

      return state;
    });

    /* Touch-primary devices: pick the single card whose center is closest
       to the viewport center, recomputed on scroll/resize. Mirrors
       LaserCard.astro's recomputeActiveCard pattern. Scopes scroll
       listener to the modal's results container — the modal is in a
       fixed overlay and the body scroll is locked while the modal is
       open. The window scroll is also listened to as a fallback for the
       case where the results don't overflow (no internal scroll). */
    let activeCard: HTMLAnchorElement | null = null;
    let rafScheduled = false;

    const recomputeActiveCard = () => {
      if (!touchPrimary) return;
      const viewportHeight = window.innerHeight;
      const viewportCenter = viewportHeight / 2;
      const activationRadius = viewportHeight * 0.35;

      let best: CardState | null = null;
      let bestDistance = Infinity;
      for (const s of states) {
        const rect = s.el.getBoundingClientRect();
        const cardCenter = (rect.top + rect.bottom) / 2;
        const distance = Math.abs(cardCenter - viewportCenter);
        if (distance > activationRadius) continue;
        if (distance < bestDistance) {
          bestDistance = distance;
          best = s;
        }
      }

      const next = best?.el ?? null;
      if (next === activeCard) return;

      if (activeCard) {
        activeCard.classList.remove('is-active');
        const prev = states.find((s) => s.el === activeCard);
        prev?.stop();
      }
      activeCard = next;
      if (next && best) {
        next.classList.add('is-active');
        best.start();
      }
    };

    const scheduleRecompute = () => {
      if (rafScheduled) return;
      rafScheduled = true;
      requestAnimationFrame(() => {
        rafScheduled = false;
        recomputeActiveCard();
      });
    };

    if (touchPrimary) {
      container.addEventListener('scroll', scheduleRecompute, { passive: true });
      window.addEventListener('scroll', scheduleRecompute, { passive: true });
      window.addEventListener('resize', scheduleRecompute, { passive: true });
      recomputeActiveCard();
    }

    return () => {
      for (const s of states) {
        s.el.removeEventListener('mouseenter', s.onMouseEnter);
        s.el.removeEventListener('focusin', s.onFocusIn);
        s.el.removeEventListener('mouseleave', s.onMouseLeave);
        s.el.removeEventListener('focusout', s.onFocusOut);
        if (s.rafId !== null) cancelAnimationFrame(s.rafId);
      }
      if (touchPrimary) {
        container.removeEventListener('scroll', scheduleRecompute);
        window.removeEventListener('scroll', scheduleRecompute);
        window.removeEventListener('resize', scheduleRecompute);
      }
      if (activeCard) activeCard.classList.remove('is-active');
    };
    /* Dependencies: re-run when the rendered card set changes. `results`
       drives the search-results state; `curatedPicks` drives the empty
       state (technically stable per-mount via props, but listed for
       correctness). `isVisible` re-runs the effect once the modal fades
       in (querySelectorAll happens against the freshly-rendered DOM). */
  }, [isVisible, results, curatedPicks]);

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

        <div className="search-modal-results" aria-live="polite" ref={resultsRef}>
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
                          {/* Cyan + plasma weave SVGs — sine paths around
                              the card perimeter, populated by the laser-
                              wave effect above (mirrors LaserCard.astro). */}
                          <svg className="weave-svg weave-cyan" aria-hidden="true">
                            <path className="weave-path" />
                          </svg>
                          <svg className="weave-svg weave-plasma" aria-hidden="true">
                            <path className="weave-path" />
                          </svg>
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
                    {/* Cyan + plasma weave SVGs — see curated-picks
                        markup above for the same pattern. */}
                    <svg className="weave-svg weave-cyan" aria-hidden="true">
                      <path className="weave-path" />
                    </svg>
                    <svg className="weave-svg weave-plasma" aria-hidden="true">
                      <path className="weave-path" />
                    </svg>
                    {/* Title + snippet pass through highlightMatches with the
                        debouncedQuery (= the query that was actually sent to
                        the API to produce these results — see the search
                        useEffect above). Match terms get wrapped in <mark
                        className="search-modal-highlight"> for the electric-
                        yellow emphasis treatment defined in SearchModal.css.
                        Path indicator is NOT highlighted — URLs are
                        navigational metadata, not content. */}
                    <h3 className="search-modal-result-title">
                      {highlightMatches(r.title, debouncedQuery)}
                    </h3>
                    <p className="search-modal-result-snippet">
                      {highlightMatches(r.snippet, debouncedQuery)}
                    </p>
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
