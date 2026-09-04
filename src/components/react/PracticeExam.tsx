/**
 * PracticeExam — the New York real estate salesperson practice exam island.
 *
 * SPR-0092. Design spec: `decisions/real-estate-practice-exam.md`.
 * Mounted from `src/pages/real-estate-practice.astro` with `client:load`.
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
import type { ExamAttempt, ExamBank, ExamResult } from '~/lib/exam/types.ts';
import { selectExam } from '~/lib/exam/select.ts';
import { formatRemaining, scoreExam } from '~/lib/exam/score.ts';
import './PracticeExam.css';

const BANK_URL = '/data/ny-real-estate-questions.json';

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

export default function PracticeExam() {
  const [phase, setPhase] = useState<Phase>('loading');
  const [bank, setBank] = useState<ExamBank | null>(null);
  const [attempt, setAttempt] = useState<ExamAttempt | null>(null);
  const [attemptKey, setAttemptKey] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [result, setResult] = useState<ExamResult | null>(null);
  const [confirmingSubmit, setConfirmingSubmit] = useState(false);
  const [reviewPosition, setReviewPosition] = useState(0);
  const [reviewTick, setReviewTick] = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const [timeAnnouncement, setTimeAnnouncement] = useState('');

  /* Questions drawn earlier this session. A ref rather than state: it never
     affects rendering, and keeping it out of the dependency graph avoids
     re-running the draw effect when it changes. */
  const seenIdsRef = useRef<Set<string>>(new Set());
  const cardRefs = useRef<Array<HTMLLIElement | null>>([]);
  const announcedWarningsRef = useRef<Set<number>>(new Set());
  const barRef = useRef<HTMLDivElement | null>(null);

  const answeredCount = Object.keys(answers).length;
  const questions = attempt?.questions ?? [];
  const unansweredCount = questions.length - answeredCount;
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
    setResult(scoreExam(attempt.questions, answers, bank.meta.passingCorrect));
    setPhase('submitted');
    setConfirmingSubmit(false);
    setReviewPosition(0);
    setReviewTick(0);
    setTimerRunning(false);
    window.scrollTo({ top: 0 });
  }, [answers, attempt, bank]);

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
    if (phase !== 'ready' || answeredCount === 0) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      /* Browsers ignore custom text now, but assigning returnValue is still
         what triggers the native prompt in several engines. */
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [phase, answeredCount]);

  /* ------------------------------------------------------------- interaction */

  const startTimer = () => {
    if (!bank) return;
    setSecondsLeft(bank.meta.timeLimitMinutes * 60);
    setTimerRunning(true);
    announcedWarningsRef.current.clear();
  };

  const chooseAnswer = (questionId: string, choiceIndex: number) => {
    setAnswers((previous) => ({ ...previous, [questionId]: choiceIndex }));
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
    if (unansweredCount > 0 && !confirmingSubmit) {
      setConfirmingSubmit(true);
      return;
    }
    handleSubmit();
  };

  const goToFirstUnanswered = () => {
    const index = questions.findIndex((question) => answers[question.id] === undefined);
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
      </div>

      <ol className="practice-exam-list" key={attemptKey}>
        {questions.map((question, index) => {
          const given = answers[question.id];
          const wasMissed = phase === 'submitted' && incorrectSet.has(index);
          const legendId = `${question.id}-legend`;

          return (
            <li
              key={question.id}
              className={`practice-exam-card${wasMissed ? ' is-missed' : ''}`}
              ref={(node) => {
                cardRefs.current[index] = node;
              }}
              tabIndex={-1}
            >
              {phase === 'submitted' ? (
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
                  {given === undefined && (
                    <p className="practice-exam-blank">You left this question blank.</p>
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
                  {unansweredCount} question{unansweredCount === 1 ? '' : 's'} unanswered.
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
              </p>
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
