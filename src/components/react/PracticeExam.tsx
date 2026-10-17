/**
 * PracticeExam — the New York real estate salesperson practice exam island.
 *
 * SPR-0092. Design spec: `decisions/real-estate-practice-exam.md`.
 * Mounted from `src/pages/real-estate-practice.astro` with `client:load`.
 *
 * SPR-0096 adds a per-question "Show the answer" affordance behind an inline
 * confirm. A revealed question renders through exactly the same branch as a
 * submitted one — the answer treatment it needs IS the post-submit treatment,
 * and reusing it locks the question's choices for free rather than by disabling
 * inputs, which is the same reason decision 004 chose static markup after
 * submit. Revealing forfeits the question (see `scoreExam`).
 *
 * The whole exam lives in this component's state. Nothing is persisted — no
 * localStorage, no sessionStorage, no server call beyond the one-time fetch of
 * the static question bank. Navigating away or reloading loses the attempt,
 * which is the specified behavior; the `beforeunload` guard below exists so
 * that loss is never a surprise rather than to prevent it.
 *
 * Layout constraints this component works around (all verified against
 * global.css and BaseLayout.astro):
 *
 *   - No `<h2>` anywhere in here. global.css sets `main > h2 { opacity: 0 }`
 *     and BaseLayout's inline script reveals them by adding `.is-laser-ready`
 *     after measuring. That script runs before this island hydrates, so an h2
 *     rendered here would stay invisible forever. h3 and below are safe.
 *
 *   - The sticky bar offsets itself by the live height of `.site-header`
 *     (position: sticky, top: 0, z-index: 100), which collapses as the page
 *     scrolls. A ResizeObserver keeps `--practice-exam-header-height` current;
 *     a hardcoded offset would drift as soon as the header animated.
 *
 *   - The bar sits at z-index 90: below the site header (100), the steam
 *     transition (200) and the search modal (300), above ordinary content.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ExamAttempt, ExamBank, ExamResult, SavedAttempt } from '~/lib/exam/types.ts';
import { selectExam } from '~/lib/exam/select.ts';
import { formatRemaining, scoreExam } from '~/lib/exam/score.ts';
import { restoreExam, resumeSeconds, toSaveRequestBody } from '~/lib/exam/save.ts';
import { formatResumeCode, normalizeResumeCode, todayLocalDate } from '~/lib/exam/resume-code.ts';
import './PracticeExam.css';

const BANK_URL = '/data/ny-real-estate-questions.json';
const SAVE_URL = '/api/exam-save';

/**
 * Give up on a save or a restore after this long.
 *
 * `fetch` has no timeout of its own, so a request that hangs — an endpoint that
 * accepts the connection and never answers — leaves the button reading
 * "Saving…" for as long as the visitor is willing to look at it, with no error,
 * no retry and no way back. Found exactly that way while testing against a
 * proxy whose target had stopped.
 */
const REQUEST_TIMEOUT_MS = 15000;

/** Countdown thresholds, in seconds, announced to assistive tech as they pass. */
const TIME_WARNINGS = [600, 300, 60];

type Phase = 'loading' | 'error' | 'ready' | 'submitted';

/**
 * All programmatic scrolling here is instant, deliberately.
 *
 * A 75-question page runs to roughly 38,000px. Smooth-scrolling between two
 * missed questions can mean animating 10,000px, which is slow enough to feel
 * broken and unpleasant enough to be worth avoiding — and a reviewer stepping
 * through twenty misses would sit through it twenty times. Review navigation
 * is a "put me there now" action, so it jumps.
 *
 * A pleasant side effect: instant scrolling is already correct under
 * prefers-reduced-motion, so there is no branch to keep in sync.
 */
const SCROLL_OPTIONS: ScrollIntoViewOptions = { block: 'start' };

/**
 * Turn a failed request into something worth reading.
 *
 * `AbortSignal.timeout` rejects with a TimeoutError whose message is engine
 * wording about an aborted signal — true, and no use to someone who just wants
 * to know whether to press the button again.
 */
function describeRequestFailure(error: unknown, fallback: string): string {
  if (error instanceof DOMException && error.name === 'TimeoutError') {
    return `${fallback} The server did not respond in time — check your connection and try again.`;
  }
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

export default function PracticeExam() {
  const [phase, setPhase] = useState<Phase>('loading');
  const [bank, setBank] = useState<ExamBank | null>(null);
  const [attempt, setAttempt] = useState<ExamAttempt | null>(null);
  const [attemptKey, setAttemptKey] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [result, setResult] = useState<ExamResult | null>(null);
  const [confirmingSubmit, setConfirmingSubmit] = useState(false);
  /* Bank ids whose answer the visitor revealed mid-exam. State rather than a
     ref: it drives rendering for the card, the progress counters and the score
     panel. Replaced wholesale on each add so React sees a new reference. */
  const [revealedIds, setRevealedIds] = useState<ReadonlySet<string>>(() => new Set());
  /* Which question's "Are you sure?" is open — at most one at a time. A single
     nullable id rather than 75 booleans, which also makes "opening one closes
     any other" fall out of the data shape instead of needing to be enforced. */
  const [confirmingRevealId, setConfirmingRevealId] = useState<string | null>(null);
  const [reviewPosition, setReviewPosition] = useState(0);
  const [reviewTick, setReviewTick] = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const [timeAnnouncement, setTimeAnnouncement] = useState('');

  /* ---------------------------------------------------- save and resume state

     `resumeCode` doubles as the "this attempt has a home on the server" flag:
     null means a save would mint a new code, set means it updates that one. */
  const [resumeCode, setResumeCode] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'error'>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [resumeInput, setResumeInput] = useState('');
  const [resumeBusy, setResumeBusy] = useState(false);
  const [resumeError, setResumeError] = useState<string | null>(null);
  /* Set when a restored save did not line up exactly with the current bank. */
  const [restoreNotice, setRestoreNotice] = useState<string | null>(null);
  /* Answers/reveals changed since the last successful save. Drives the button
     label, so "Saved" never lingers over work the server has not seen. */
  const [dirtySinceSave, setDirtySinceSave] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);

  /* Questions drawn earlier this session. A ref rather than state: it never
     affects rendering, and keeping it out of the dependency graph avoids
     re-running the draw effect when it changes. */
  const seenIdsRef = useRef<Set<string>>(new Set());
  const cardRefs = useRef<Array<HTMLLIElement | null>>([]);
  const announcedWarningsRef = useRef<Set<number>>(new Set());
  const barRef = useRef<HTMLDivElement | null>(null);
  /* Only one reveal confirm is mounted at a time, so one ref covers all 75. */
  const revealConfirmRef = useRef<HTMLButtonElement | null>(null);

  const questions = attempt?.questions ?? [];
  /* Three disjoint buckets, all derived from the attempt's own questions rather
     than from the sizes of `answers` and `revealedIds` — a question can carry a
     selection made *before* its answer was revealed, so the raw sizes overlap
     and would double-count it.

       revealed   — forfeited, scored incorrect, choices locked
       answered   — has a selection that still counts
       unresolved — neither; what the submit confirm warns about */
  const revealedCount = questions.reduce(
    (total, question) => total + (revealedIds.has(question.id) ? 1 : 0),
    0,
  );
  const answeredCount = questions.reduce(
    (total, question) =>
      total + (!revealedIds.has(question.id) && answers[question.id] !== undefined ? 1 : 0),
    0,
  );
  const unresolvedCount = questions.length - answeredCount - revealedCount;
  /* Computed before the early returns below so the measuring effect, which
     depends on it, stays above them and the hook order never varies. */
  const showBar = phase === 'submitted' || timerRunning;

  /* ---------------------------------------------------------------- bank load */

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch(BANK_URL);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const loaded = (await response.json()) as ExamBank;
        if (cancelled) return;
        setBank(loaded);
        setAttempt(selectExam(loaded, seenIdsRef.current));
        setPhase('ready');
      } catch {
        if (!cancelled) setPhase('error');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  /* Record what this attempt drew, so the next retake prefers questions the
     visitor has not seen yet. */
  useEffect(() => {
    if (!attempt) return;
    for (const id of attempt.drawnIds) seenIdsRef.current.add(id);
  }, [attempt]);

  /* ------------------------------------------------- sticky offset measurement

     Two moving numbers decide where a reviewed card comes to rest: the site
     header's height (it collapses on scroll) and this island's own bar height
     (it wraps to two rows on narrow viewports). Both are published as custom
     properties on :root and consumed by `.practice-exam-bar`'s `top` and
     `.practice-exam-card`'s `scroll-margin-top`. Measuring beats hardcoding —
     the header animates, and a stale offset parks cards underneath it. */

  useEffect(() => {
    const header = document.querySelector<HTMLElement>('.site-header');
    /* `.header-bar` is the element that actually moves. In the header's
       "minimal" state it gets transform: translateY(-100%) while .site-header
       keeps its full layout height — so measuring .site-header reports 112px
       of header that is no longer on screen, and the sticky bar parks 112px
       down the viewport with a band of dead space above it. Measuring the
       moved element's bottom edge is what tracks what a visitor can see. */
    const headerBar = header?.querySelector<HTMLElement>('.header-bar') ?? header;
    if (!header || !headerBar) return;

    let frame = 0;
    const apply = () => {
      frame = 0;
      const visibleBottom = Math.max(0, Math.round(headerBar.getBoundingClientRect().bottom));
      document.documentElement.style.setProperty(
        '--practice-exam-header-height',
        `${visibleBottom}px`,
      );
    };
    /* Coalesce to one measurement per frame — scroll fires far faster than
       paint, and this runs on a page ~38,000px tall. */
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(apply);
    };

    apply();
    window.addEventListener('scroll', schedule, { passive: true });
    /* The collapse is a CSS transition. Scrolling samples it while it runs;
       transitionend catches the final resting value if the visitor stops
       scrolling mid-animation. */
    headerBar.addEventListener('transitionend', schedule);
    const observer = new ResizeObserver(schedule);
    observer.observe(header);
    observer.observe(headerBar);

    return () => {
      window.removeEventListener('scroll', schedule);
      headerBar.removeEventListener('transitionend', schedule);
      observer.disconnect();
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  useEffect(() => {
    const bar = barRef.current;
    if (!bar) {
      /* No bar on screen: drop the property so the CSS var() fallback applies. */
      document.documentElement.style.removeProperty('--practice-exam-bar-height');
      return;
    }
    const apply = () => {
      const height = Math.round(bar.getBoundingClientRect().height);
      document.documentElement.style.setProperty('--practice-exam-bar-height', `${height}px`);
    };
    apply();
    const observer = new ResizeObserver(apply);
    observer.observe(bar);
    return () => observer.disconnect();
  }, [showBar]);

  /* ------------------------------------------------------------------- timer */

  const handleSubmit = useCallback(() => {
    if (!bank || !attempt) return;
    setResult(scoreExam(attempt.questions, answers, bank.meta.passingCorrect, revealedIds));
    setPhase('submitted');
    setConfirmingSubmit(false);
    setConfirmingRevealId(null);
    setReviewPosition(0);
    setReviewTick(0);
    setTimerRunning(false);
    window.scrollTo({ top: 0 });
  }, [answers, attempt, bank, revealedIds]);

  /* `handleSubmit` is captured fresh each tick via the dependency array, so the
     auto-submit at zero always grades the latest answers rather than a stale
     closure's copy. */
  useEffect(() => {
    if (!timerRunning || phase !== 'ready') return;
    const id = window.setInterval(() => {
      setSecondsLeft((previous) => {
        if (previous === null) return previous;
        const next = previous - 1;
        for (const threshold of TIME_WARNINGS) {
          if (next === threshold && !announcedWarningsRef.current.has(threshold)) {
            announcedWarningsRef.current.add(threshold);
            setTimeAnnouncement(
              threshold >= 60
                ? `${threshold / 60} minutes remaining.`
                : `${threshold} seconds remaining.`,
            );
          }
        }
        return next;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [timerRunning, phase]);

  useEffect(() => {
    if (secondsLeft !== null && secondsLeft <= 0 && phase === 'ready') {
      setTimeAnnouncement('Time expired. The exam has been submitted.');
      handleSubmit();
    }
  }, [secondsLeft, phase, handleSubmit]);

  /* --------------------------------------------------------- unload guarding */

  useEffect(() => {
    /* Revealing counts as progress worth warning about, same as answering —
       a reload would hand back a fresh exam and discard the forfeits too. */
    if (phase !== 'ready' || answeredCount + revealedCount === 0) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      /* Browsers ignore custom text now, but assigning returnValue is still
         what triggers the native prompt in several engines. */
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [phase, answeredCount, revealedCount]);

  /* ------------------------------------------------- reveal confirm focus

     The confirm replaces the trigger button in place, so without this the
     visitor's focus lands on a button that no longer exists and falls to the
     body — on a 38,000px page that means losing their position entirely.
     Focusing the destructive action is safe here because it still takes a
     deliberate second press, and it is the one a keyboard user came for. */

  useEffect(() => {
    if (!confirmingRevealId) return;
    revealConfirmRef.current?.focus();
  }, [confirmingRevealId]);

  /* ------------------------------------------------------------- interaction */

  const startTimer = () => {
    if (!bank) return;
    setSecondsLeft(bank.meta.timeLimitMinutes * 60);
    setTimerRunning(true);
    announcedWarningsRef.current.clear();
  };

  const chooseAnswer = (questionId: string, choiceIndex: number) => {
    setAnswers((previous) => ({ ...previous, [questionId]: choiceIndex }));
    setDirtySinceSave(true);
  };

  /* Reveal is two-step on purpose: the whole point of the confirm is that a
     mis-click should not be able to spend a question. */
  const revealAnswer = (questionId: string, index: number) => {
    setRevealedIds((previous) => {
      const next = new Set(previous);
      next.add(questionId);
      return next;
    });
    setConfirmingRevealId(null);
    setDirtySinceSave(true);
    /* The confirm's buttons are about to unmount, so focus would fall to the
       document body and a screen-reader user would lose their place entirely.
       Move it to the card, which now holds the answer they asked for. The card
       carries tabIndex={-1} for exactly this (the review navigation focuses it
       the same way). */
    requestAnimationFrame(() => cardRefs.current[index]?.focus({ preventScroll: true }));
  };

  /* ------------------------------------------------------- save and resume */

  /**
   * Write the attempt to the server and keep (or mint) its resume code.
   *
   * The timer is saved only when it was actually started — `secondsLeft` can
   * hold a stale number otherwise, and resuming into a countdown the visitor
   * never asked for would be a surprise.
   */
  const saveAttempt = async () => {
    if (!bank || !attempt) return;
    setSaveState('saving');
    setSaveError(null);
    try {
      const packed = toSaveRequestBody(
        attempt,
        answers,
        revealedIds,
        timerRunning ? secondsLeft : null,
        bank.meta.version,
      );
      /* A code in hand updates that object; no code asks for a new one. */
      const response = await fetch(resumeCode ? `${SAVE_URL}/${resumeCode}` : SAVE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        body: JSON.stringify(
          resumeCode
            ? { attempt: packed }
            : { attempt: packed, localDate: todayLocalDate() },
        ),
      });
      const payload = (await response.json().catch(() => null)) as
        | { code?: string; error?: string }
        | null;
      if (!response.ok || !payload?.code) {
        throw new Error(payload?.error ?? `The save failed (HTTP ${response.status}).`);
      }
      setResumeCode(payload.code);
      setSaveState('idle');
      setDirtySinceSave(false);
    } catch (error) {
      setSaveState('error');
      setSaveError(describeRequestFailure(error, 'The save could not be completed.'));
    }
  };

  /** Swap the live attempt for a restored one. */
  const applyRestore = (saved: SavedAttempt, code: string) => {
    if (!bank) return false;
    const restored = restoreExam(bank, saved);

    /* Every question gone means the bank was rewritten wholesale. There is
       nothing to restore into, and pretending otherwise would hand back an
       empty exam that grades 0/0. */
    if (restored.attempt.questions.length === 0) return false;

    setAttempt(restored.attempt);
    setAttemptKey((key) => key + 1);
    setAnswers(restored.answers);
    setRevealedIds(restored.revealedIds);
    setResult(null);
    setPhase('ready');
    setConfirmingSubmit(false);
    setConfirmingRevealId(null);
    setReviewPosition(0);
    setReviewTick(0);
    cardRefs.current = [];
    setResumeCode(code);
    setResumeInput('');
    setDirtySinceSave(false);
    setSaveState('idle');
    setSaveError(null);

    const seconds = resumeSeconds(restored.secondsLeft, bank.meta.timeLimitMinutes);
    announcedWarningsRef.current.clear();
    setSecondsLeft(seconds);
    setTimerRunning(seconds !== null);

    /* Say what did not line up rather than restoring silently. A save can be
       two weeks old, and the bank gets edited for legal accuracy. */
    const notes: string[] = [];
    if (restored.missingIds.length > 0) {
      const count = restored.missingIds.length;
      notes.push(
        `${count} question${count === 1 ? '' : 's'} from that save ${
          count === 1 ? 'is' : 'are'
        } no longer in the bank and ${count === 1 ? 'was' : 'were'} dropped`,
      );
    } else if (restored.bankChanged) {
      notes.push('the question bank has been revised since you saved, though your questions all survived');
    }
    setRestoreNotice(
      notes.length > 0
        ? `Restored ${restored.attempt.questions.length} questions — ${notes.join('; ')}.`
        : null,
    );

    window.scrollTo({ top: 0 });
    return true;
  };

  /* Clipboard access can be refused (permissions, insecure context, older
     engines). The code is on screen regardless, so a failed copy just leaves
     the button as it was rather than raising an error about it. */
  const copyResumeCode = async () => {
    if (!resumeCode) return;
    try {
      await navigator.clipboard.writeText(formatResumeCode(resumeCode));
      setCodeCopied(true);
      window.setTimeout(() => setCodeCopied(false), 2000);
    } catch {
      /* Nothing to do — the visitor can still read and type it. */
    }
  };

  const resumeFromCode = async () => {
    if (!bank) return;
    const code = normalizeResumeCode(resumeInput);
    if (!code) {
      setResumeError('That is not a resume code — they are eight digits, then eight more characters.');
      return;
    }
    setResumeBusy(true);
    setResumeError(null);
    try {
      const response = await fetch(`${SAVE_URL}/${code}`, {
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      const payload = (await response.json().catch(() => null)) as
        | { attempt?: SavedAttempt; error?: string }
        | null;
      if (!response.ok || !payload?.attempt) {
        throw new Error(payload?.error ?? 'No saved exam found for that code.');
      }
      if (!applyRestore(payload.attempt, code)) {
        throw new Error('That save is too old to restore — none of its questions are still in the bank.');
      }
    } catch (error) {
      setResumeError(describeRequestFailure(error, 'That code could not be loaded.'));
    } finally {
      setResumeBusy(false);
    }
  };

  const scrollToQuestion = useCallback((index: number, focus = true) => {
    const card = cardRefs.current[index];
    if (!card) return;
    card.scrollIntoView(SCROLL_OPTIONS);
    /* preventScroll so focusing does not fight the positioning that
       scroll-margin-top just established on the line above. */
    if (focus) card.focus({ preventScroll: true });
  }, []);

  /* Scroll to whichever missed question the review position settled on. Driven
     by `reviewTick` so it fires only on an explicit Prev/Next, never on the
     position being reset to 0 at submit or retake. Batched clicks land here
     once, at the final position, rather than scrolling through intermediates. */
  useEffect(() => {
    if (reviewTick === 0) return;
    const indices = result?.incorrectIndices;
    if (!indices || indices.length === 0) return;
    scrollToQuestion(indices[reviewPosition]);
  }, [reviewTick, reviewPosition, result, scrollToQuestion]);

  const attemptSubmit = () => {
    if (unresolvedCount > 0 && !confirmingSubmit) {
      setConfirmingSubmit(true);
      return;
    }
    handleSubmit();
  };

  /* Revealed questions are deliberately not candidates. Their choices are
     locked, so parking the visitor on one in response to "go to first
     unanswered" would be a dead end — and they are already accounted for. */
  const goToFirstUnanswered = () => {
    const index = questions.findIndex(
      (question) => !revealedIds.has(question.id) && answers[question.id] === undefined,
    );
    if (index >= 0) {
      setConfirmingSubmit(false);
      scrollToQuestion(index);
    }
  };

  /* Functional update, not `reviewPosition + delta`. Several clicks landing in
     one React batch would otherwise each read the same stale position from
     this closure and collapse into a single step — click Next three times
     quickly and you would advance one question. `reviewTick` is what drives
     the scroll: it separates "the visitor asked to move" from "position was
     initialised to 0 on submit", so grading can scroll to the top of the page
     without the review effect yanking it to the first missed question. */
  const stepReview = (delta: number) => {
    const count = result?.incorrectIndices.length ?? 0;
    if (count === 0) return;
    setReviewPosition((current) => (current + delta + count) % count);
    setReviewTick((tick) => tick + 1);
  };

  const retake = () => {
    if (!bank) return;
    setAttempt(selectExam(bank, seenIdsRef.current));
    setAttemptKey((key) => key + 1);
    setAnswers({});
    setRevealedIds(new Set());
    setConfirmingRevealId(null);
    /* A retake is a different exam, so it does not inherit the old code —
       saving it would otherwise overwrite the saved attempt with a set of
       questions that has nothing to do with it. */
    setResumeCode(null);
    setSaveState('idle');
    setSaveError(null);
    setRestoreNotice(null);
    setDirtySinceSave(false);
    setResult(null);
    setPhase('ready');
    setConfirmingSubmit(false);
    setReviewPosition(0);
    setReviewTick(0);
    setTimerRunning(false);
    setSecondsLeft(null);
    setTimeAnnouncement('');
    announcedWarningsRef.current.clear();
    cardRefs.current = [];
    window.scrollTo({ top: 0 });
  };

  /* ----------------------------------------------------------------- render */

  const incorrectSet = useMemo(
    () => new Set(result?.incorrectIndices ?? []),
    [result],
  );

  if (phase === 'loading') {
    return (
      <div className="practice-exam practice-exam-status" role="status">
        <p>Drawing your exam…</p>
      </div>
    );
  }

  if (phase === 'error' || !bank || !attempt) {
    return (
      <div className="practice-exam practice-exam-status" role="alert">
        <p>The question bank could not be loaded. Check your connection and reload the page.</p>
      </div>
    );
  }

  const { meta } = bank;
  const incorrectCount = result?.incorrectIndices.length ?? 0;

  return (
    <div className="practice-exam">
      {showBar && (
        <div className="practice-exam-bar" ref={barRef} role="region" aria-label="Exam controls">
          {phase === 'submitted' && result ? (
            <>
              <p className="practice-exam-bar-score">
                <strong>
                  {result.correctCount} / {result.totalCount}
                </strong>
                <span className="practice-exam-bar-sep" aria-hidden="true">·</span>
                {result.percent}%
                <span className="practice-exam-bar-sep" aria-hidden="true">·</span>
                <span
                  className={
                    result.passed ? 'practice-exam-verdict is-pass' : 'practice-exam-verdict is-fail'
                  }
                >
                  {result.passed ? 'Passed' : 'Did not pass'}
                </span>
              </p>
              {incorrectCount > 0 ? (
                <div className="practice-exam-bar-nav">
                  <button type="button" onClick={() => stepReview(-1)} aria-label="Previous missed question">
                    ‹ Prev
                  </button>
                  <span className="practice-exam-bar-counter">
                    Missed {reviewPosition + 1} of {incorrectCount}
                  </span>
                  <button type="button" onClick={() => stepReview(1)} aria-label="Next missed question">
                    Next ›
                  </button>
                </div>
              ) : (
                <p className="practice-exam-bar-counter">No incorrect answers.</p>
              )}
              <button type="button" className="practice-exam-retake" onClick={retake}>
                Retake
              </button>
            </>
          ) : (
            <>
              <p className="practice-exam-bar-timer">
                <span className="practice-exam-bar-label">Time left</span>{' '}
                <strong>{formatRemaining(secondsLeft ?? 0)}</strong>
              </p>
              <p className="practice-exam-bar-counter">
                {answeredCount} of {questions.length} answered
                {revealedCount > 0 && (
                  <>
                    <span className="practice-exam-bar-sep" aria-hidden="true">·</span>
                    {revealedCount} revealed
                  </>
                )}
              </p>
              <button type="button" className="practice-exam-submit-inline" onClick={attemptSubmit}>
                Submit exam
              </button>
            </>
          )}
        </div>
      )}

      {/* Announcements for assistive tech. The ticking clock itself is not a
          live region — announcing every second would be unusable. */}
      <p className="practice-exam-sr-only" role="status" aria-live="polite">
        {timeAnnouncement}
      </p>

      <div className="practice-exam-intro">
        {phase === 'submitted' && result ? (
          <div
            className={result.passed ? 'practice-exam-score is-pass' : 'practice-exam-score is-fail'}
            role="status"
            aria-live="polite"
          >
            <p className="practice-exam-score-headline">
              {result.correctCount} of {result.totalCount} correct — {result.percent}%
            </p>
            <p className="practice-exam-score-verdict">
              {result.passed
                ? `That clears the ${meta.passingCorrect}-correct mark this tool grades against.`
                : `That is below the ${meta.passingCorrect}-correct mark this tool grades against.`}
            </p>
            {result.unansweredCount > 0 && (
              <p className="practice-exam-score-note">
                {result.unansweredCount} question{result.unansweredCount === 1 ? ' was' : 's were'} left
                blank and scored as incorrect.
              </p>
            )}
            {result.revealedCount > 0 && (
              <p className="practice-exam-score-note">
                You revealed {result.revealedCount} answer{result.revealedCount === 1 ? '' : 's'},
                scored as incorrect.
              </p>
            )}
          </div>
        ) : (
          <div className="practice-exam-setup">
            <p className="practice-exam-setup-facts">
              {questions.length} questions · {meta.passingCorrect} correct to pass · answer in any order
            </p>
            {timerRunning ? (
              <p className="practice-exam-setup-timer" aria-live="off">
                Timer running — <strong>{formatRemaining(secondsLeft ?? 0)}</strong> left
              </p>
            ) : (
              <button type="button" className="practice-exam-timer-start" onClick={startTimer}>
                Start {meta.timeLimitMinutes}-minute timer
              </button>
            )}
          </div>
        )}

        {restoreNotice && (
          <p className="practice-exam-restore-notice" role="status">
            {restoreNotice}
          </p>
        )}

        {/* The code panel stays up for the rest of the sitting rather than
            appearing once and sliding away. It is the single thing a visitor
            must not lose, and a toast would be exactly the wrong shape. */}
        {resumeCode && phase !== 'submitted' && (
          <div className="practice-exam-code" role="status">
            <p className="practice-exam-code-label">Your resume code</p>
            <div className="practice-exam-code-row">
              <code className="practice-exam-code-value">{formatResumeCode(resumeCode)}</code>
              <button type="button" onClick={copyResumeCode}>
                {codeCopied ? 'Copied' : 'Copy'}
              </button>
            </div>
            <p className="practice-exam-code-note">
              Write this down. There is no account and no email — this code is the only way back
              to this exam, and it stops working two weeks from today.
            </p>
          </div>
        )}

        {/* Offered only before any work exists, so restoring can never discard
            answers. No confirm needed if the destructive case cannot arise. */}
        {phase === 'ready' && !resumeCode && answeredCount + revealedCount === 0 && (
          <form
            className="practice-exam-resume"
            onSubmit={(event) => {
              event.preventDefault();
              void resumeFromCode();
            }}
          >
            <label className="practice-exam-resume-label" htmlFor="practice-exam-resume-input">
              Picking up a saved exam? Enter its resume code.
            </label>
            <div className="practice-exam-resume-row">
              <input
                id="practice-exam-resume-input"
                className="practice-exam-resume-input"
                type="text"
                autoComplete="off"
                spellCheck={false}
                placeholder="20260113-K7R4Q2X9"
                value={resumeInput}
                onChange={(event) => {
                  setResumeInput(event.target.value);
                  setResumeError(null);
                }}
              />
              <button type="submit" disabled={resumeBusy || resumeInput.trim() === ''}>
                {resumeBusy ? 'Loading…' : 'Resume'}
              </button>
            </div>
            {resumeError && (
              <p className="practice-exam-resume-error" role="alert">
                {resumeError}
              </p>
            )}
          </form>
        )}
      </div>

      <ol className="practice-exam-list" key={attemptKey}>
        {questions.map((question, index) => {
          const given = answers[question.id];
          const isRevealed = revealedIds.has(question.id);
          /* One question shows its answer because the visitor asked for it;
             after submit they all do. Same markup either way — the post-submit
             treatment IS the answer treatment, and routing a revealed question
             through it locks the choices without disabling any inputs. */
          const showingAnswer = phase === 'submitted' || isRevealed;
          const wasMissed = phase === 'submitted' && incorrectSet.has(index);
          const legendId = `${question.id}-legend`;

          return (
            <li
              key={question.id}
              className={`practice-exam-card${wasMissed ? ' is-missed' : ''}${
                phase === 'ready' && isRevealed ? ' is-revealed' : ''
              }`}
              ref={(node) => {
                cardRefs.current[index] = node;
              }}
              tabIndex={-1}
            >
              {showingAnswer ? (
                <div role="group" aria-labelledby={legendId}>
                  <div className="practice-exam-legend" id={legendId}>
                    <span className="practice-exam-number">Question {index + 1}</span>
                    <span className="practice-exam-topic">{question.topicLabel}</span>
                    <span className="practice-exam-prompt">{question.prompt}</span>
                  </div>
                  <ul className="practice-exam-choices">
                    {question.shuffledChoices.map((choice, choiceIndex) => {
                      const isCorrect = choiceIndex === question.answer;
                      const isGiven = given === choiceIndex;
                      return (
                        <li
                          key={choiceIndex}
                          className={`practice-exam-choice${isCorrect ? ' is-correct' : ''}${
                            isGiven && !isCorrect ? ' is-wrong' : ''
                          }`}
                        >
                          <span className="practice-exam-choice-text">{choice}</span>
                          {isCorrect && <span className="practice-exam-tag">Correct answer</span>}
                          {isGiven && !isCorrect && (
                            <span className="practice-exam-tag">Your answer — incorrect</span>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                  {/* Mutually exclusive, matching how `scoreExam` counts them:
                      revealing locks the choices, so a question revealed before
                      being answered is also blank, and saying both would report
                      one forfeit twice. */}
                  {isRevealed ? (
                    <p className="practice-exam-revealed-note">
                      {/* A visitor who had already picked correctly sees the
                          "Correct answer" tag on their own selection, so the
                          bare version of this line reads as a contradiction.
                          Name the rule instead of restating the verdict. */}
                      {given === question.answer
                        ? 'Your selection here was right, but revealing forfeits the question — it is scored as incorrect.'
                        : 'You revealed this answer, so it is scored as incorrect.'}
                    </p>
                  ) : (
                    given === undefined && (
                      <p className="practice-exam-blank">You left this question blank.</p>
                    )
                  )}
                  <div className="practice-exam-explanation">
                    <p>{question.explanation}</p>
                    <p className="practice-exam-citation">{question.citation}</p>
                  </div>
                </div>
              ) : (
                <fieldset className="practice-exam-fieldset">
                  <legend className="practice-exam-legend">
                    <span className="practice-exam-number">Question {index + 1}</span>
                    <span className="practice-exam-topic">{question.topicLabel}</span>
                    <span className="practice-exam-prompt">{question.prompt}</span>
                  </legend>
                  <ul className="practice-exam-choices">
                    {question.shuffledChoices.map((choice, choiceIndex) => (
                      <li key={choiceIndex} className="practice-exam-choice">
                        <label className="practice-exam-label">
                          <input
                            type="radio"
                            name={question.id}
                            value={choiceIndex}
                            checked={given === choiceIndex}
                            onChange={() => chooseAnswer(question.id, choiceIndex)}
                          />
                          <span className="practice-exam-choice-text">{choice}</span>
                        </label>
                      </li>
                    ))}
                  </ul>

                  {confirmingRevealId === question.id ? (
                    <div
                      className="practice-exam-reveal-confirm"
                      role="alertdialog"
                      aria-label={`Reveal the answer to question ${index + 1}?`}
                      onKeyDown={(event) => {
                        if (event.key === 'Escape') setConfirmingRevealId(null);
                      }}
                    >
                      <p>
                        <strong>Are you sure?</strong> Revealing the answer scores this question as
                        incorrect, and you will not be able to change your choice.
                      </p>
                      <div className="practice-exam-reveal-actions">
                        <button
                          type="button"
                          className="practice-exam-danger"
                          ref={revealConfirmRef}
                          onClick={() => revealAnswer(question.id, index)}
                        >
                          Yes, show it
                        </button>
                        <button type="button" onClick={() => setConfirmingRevealId(null)}>
                          Keep working
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="practice-exam-reveal"
                      onClick={() => setConfirmingRevealId(question.id)}
                    >
                      Show the answer
                    </button>
                  )}
                </fieldset>
              )}
            </li>
          );
        })}
      </ol>

      {phase === 'ready' && (
        <div className="practice-exam-footer">
          {confirmingSubmit ? (
            <div className="practice-exam-confirm" role="alertdialog" aria-label="Confirm submission">
              <p>
                <strong>
                  {unresolvedCount} question{unresolvedCount === 1 ? '' : 's'} unanswered.
                </strong>{' '}
                Blank answers are scored as incorrect.
              </p>
              <div className="practice-exam-confirm-actions">
                <button type="button" onClick={goToFirstUnanswered}>
                  Go to first unanswered
                </button>
                <button type="button" onClick={() => setConfirmingSubmit(false)}>
                  Keep working
                </button>
                <button type="button" className="practice-exam-danger" onClick={handleSubmit}>
                  Submit anyway
                </button>
              </div>
            </div>
          ) : (
            <>
              <p className="practice-exam-footer-count">
                {answeredCount} of {questions.length} answered
                {revealedCount > 0 && ` · ${revealedCount} revealed`}
              </p>
              <button
                type="button"
                className="practice-exam-save"
                onClick={() => void saveAttempt()}
                disabled={saveState === 'saving' || (resumeCode !== null && !dirtySinceSave)}
              >
                {saveState === 'saving'
                  ? 'Saving…'
                  : resumeCode === null
                    ? 'Save and finish later'
                    : dirtySinceSave
                      ? 'Update saved exam'
                      : 'Saved'}
              </button>
              {saveError && (
                <p className="practice-exam-save-error" role="alert">
                  {saveError}
                </p>
              )}
              <button type="button" className="practice-exam-submit-main" onClick={attemptSubmit}>
                Submit exam
              </button>
            </>
          )}
        </div>
      )}

      {phase === 'submitted' && (
        <div className="practice-exam-footer">
          <button type="button" className="practice-exam-submit-main" onClick={retake}>
            Retake with 75 new questions
          </button>
        </div>
      )}
    </div>
  );
}
