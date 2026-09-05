/**
 * ScrollControls — a draggable scroll thumb plus a back-to-top button.
 *
 * SPR-0094. Built for /real-estate-practice, where a 75-question attempt runs
 * to roughly 33,000px. On a page that long the native scrollbar thumb shrinks
 * to a sliver and the site's own scroll indicator (the purple laser on main's
 * left edge) is deliberately `pointer-events: none`, so there is nothing to
 * grab. This adds something to grab.
 *
 * Both controls live in one component because they share a single
 * rAF-throttled scroll listener and, more importantly, share a column on the
 * right of the viewport — the thumb's track has to stop short of wherever the
 * back-to-top button sits, and that is easier to guarantee from one place than
 * to coordinate between two.
 *
 * Two things are measured rather than hardcoded:
 *
 *   - The footer's VISIBLE height. `.site-footer` is fixed to the viewport
 *     bottom and slides out via translateY, so its layout height says nothing
 *     about how much of the bottom it currently covers. Measuring the gap to
 *     its top edge stays correct mid-slide and across tiers (54px at 1280px,
 *     48px at 375px, and whatever a future footer change makes it).
 *
 *   - The track height, so thumb travel maps to scroll range exactly.
 *
 * Horizontal placement is `right: 1rem`, which is inset from the viewport edge
 * (per Sean's direction) and, at desktop tiers, lands just inside
 * `.screen-edge-rope` — that decoration tracks main's right edge and sits
 * 41-68px in at 1280px. The thumb paints above it either way.
 */
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import './ScrollControls.css';

/** Thumb diameter, in px. Mirrors the 1.5rem in the stylesheet. */
const THUMB_SIZE = 24;

/** Keyboard step, as a fraction of a viewport height. */
const ARROW_STEP = 0.15;

function maxScroll(): number {
  return Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
}

export default function ScrollControls() {
  const [progress, setProgress] = useState(0);
  const [scrollable, setScrollable] = useState(false);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const [dragging, setDragging] = useState(false);

  const trackRef = useRef<HTMLDivElement | null>(null);
  /** Pointer offset within the thumb at grab time, so it does not jump under the cursor. */
  const grabOffsetRef = useRef(0);
  const frameRef = useRef(0);
  /* Suppress the scroll listener's own updates while dragging — the drag
     handler is already setting progress, and letting the listener write it too
     produces a visible fight between the two. */
  const draggingRef = useRef(false);

  /* ------------------------------------------------------- scroll tracking */

  useEffect(() => {
    const read = () => {
      frameRef.current = 0;
      const limit = maxScroll();
      setScrollable(limit > 0);
      setShowBackToTop(window.scrollY > window.innerHeight);
      if (!draggingRef.current) {
        setProgress(limit > 0 ? Math.min(1, Math.max(0, window.scrollY / limit)) : 0);
      }
    };
    const schedule = () => {
      if (!frameRef.current) frameRef.current = requestAnimationFrame(read);
    };

    read();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    /* The page grows and shrinks as the exam is submitted and retaken, which
       changes the scroll range without any scroll or resize event firing. */
    const observer = new ResizeObserver(schedule);
    observer.observe(document.body);

    return () => {
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      observer.disconnect();
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, []);

  /* ------------------------------------------- footer clearance measurement */

  useEffect(() => {
    const footer = document.querySelector<HTMLElement>('.site-footer');
    if (!footer) return;
    let frame = 0;
    const apply = () => {
      frame = 0;
      /* How much of the viewport bottom the footer currently covers. Reading
         the gap to its top edge rather than its height keeps this correct
         while it is mid-slide. */
      const covered = Math.max(0, Math.round(window.innerHeight - footer.getBoundingClientRect().top));
      document.documentElement.style.setProperty('--scroll-controls-footer', `${covered}px`);
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(apply);
    };
    apply();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    footer.addEventListener('transitionend', schedule);
    const observer = new ResizeObserver(schedule);
    observer.observe(footer);
    return () => {
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      footer.removeEventListener('transitionend', schedule);
      observer.disconnect();
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  /* ------------------------------------------------------------- dragging  */

  /** Map a viewport Y to a scroll position and jump there. */
  const scrollToPointer = useCallback((clientY: number) => {
    const track = trackRef.current;
    if (!track) return;
    const rect = track.getBoundingClientRect();
    const travel = rect.height - THUMB_SIZE;
    if (travel <= 0) return;
    const top = clientY - rect.top - grabOffsetRef.current;
    const fraction = Math.min(1, Math.max(0, top / travel));
    setProgress(fraction);
    window.scrollTo({ top: fraction * maxScroll() });
  }, []);

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    const thumb = event.currentTarget;
    /* Grab offset measured against the thumb itself, so the circle stays put
       under the cursor instead of snapping its centre to the pointer. */
    grabOffsetRef.current = event.clientY - thumb.getBoundingClientRect().top;
    thumb.setPointerCapture(event.pointerId);
    draggingRef.current = true;
    setDragging(true);
    event.preventDefault();
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return;
    scrollToPointer(event.clientY);
  };

  const endDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    setDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const limit = maxScroll();
    if (limit <= 0) return;
    const viewport = window.innerHeight;
    const moves: Record<string, number> = {
      ArrowDown: viewport * ARROW_STEP,
      ArrowUp: -viewport * ARROW_STEP,
      PageDown: viewport * 0.9,
      PageUp: -viewport * 0.9,
    };
    if (event.key in moves) {
      window.scrollTo({ top: window.scrollY + moves[event.key] });
    } else if (event.key === 'Home') {
      window.scrollTo({ top: 0 });
    } else if (event.key === 'End') {
      window.scrollTo({ top: limit });
    } else {
      return;
    }
    event.preventDefault();
  };

  /* ---------------------------------------------------------------- render */

  const percent = Math.round(progress * 100);

  return (
    <>
      <div
        className={`scroll-controls-track${scrollable ? '' : ' is-hidden'}`}
        ref={trackRef}
        aria-hidden={!scrollable}
      >
        <div
          className={`scroll-controls-thumb${dragging ? ' is-dragging' : ''}`}
          style={{ top: `calc(${progress} * (100% - ${THUMB_SIZE}px))` }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onKeyDown={onKeyDown}
          /* `slider` rather than `scrollbar`: the ARIA contract for scrollbar
             requires aria-controls naming the scrolled element, and what is
             being scrolled here is the document itself, which has no id to
             point at. A labelled vertical slider describes the control
             honestly and carries the same keyboard expectations. */
          role="slider"
          aria-orientation="vertical"
          aria-label="Scroll position"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
          aria-valuetext={`${percent}% down the page`}
          tabIndex={0}
        />
      </div>

      <button
        type="button"
        className={`scroll-controls-top${showBackToTop ? ' is-visible' : ''}`}
        onClick={() => window.scrollTo({ top: 0 })}
        aria-label="Back to top"
        /* Removed from the tab order while off-screen so keyboard users do not
           land on an invisible control. */
        tabIndex={showBackToTop ? 0 : -1}
        aria-hidden={!showBackToTop}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path
            d="M12 19V6M12 6l-6 6M12 6l6 6"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
    </>
  );
}
