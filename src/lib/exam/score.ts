/**
 * Grading for a submitted practice exam attempt.
 *
 * SPR-0092. Design spec: `decisions/real-estate-practice-exam.md`.
 *
 * Unanswered questions count as incorrect, matching the real exam — there's no
 * partial credit and no penalty-free skip.
 *
 * SPR-0096 adds a second way to lose a question: revealing its answer mid-exam.
 * A revealed question is forfeited outright rather than graded on whatever was
 * selected beforehand. Grading the prior selection would make the affordance
 * free whenever the visitor had already guessed right, which turns the score
 * into a measure of how confidently they guessed rather than what they knew.
 *
 * NOTE ON THE PERCENTAGE: the real NY exam reports pass/fail with no numerical
 * score at all (DOS: results are "either passed or failed; you will not receive
 * a numerical score"). The percentage here is a study aid, and the page copy
 * says so. The 70% cutoff is prep-industry consensus rather than a
 * DOS-published figure; it lives in `meta.passingCorrect` so it is changeable
 * in one place if that ever firms up.
 */
import type { AttemptQuestion, ExamResult } from './types.ts';

/**
 * Grade an attempt.
 *
 * @param questions      The attempt's questions, in display order.
 * @param answers        Selected choice index per question id. Missing key = unanswered.
 * @param passingCorrect Correct answers needed to pass (from `meta.passingCorrect`).
 * @param revealedIds    Question ids whose answer the visitor revealed mid-exam.
 *                       Each is forfeited — scored incorrect whatever `answers`
 *                       holds for it. Defaults to empty, so a caller that does
 *                       not offer the reveal affordance grades exactly as before.
 */
export function scoreExam(
  questions: readonly AttemptQuestion[],
  answers: Readonly<Record<string, number>>,
  passingCorrect: number,
  revealedIds: ReadonlySet<string> = new Set(),
): ExamResult {
  const incorrectIndices: number[] = [];
  let correctCount = 0;
  let unansweredCount = 0;
  let revealedCount = 0;

  questions.forEach((question, index) => {
    /* Revealed is checked before the blank check, not after. The reveal
       affordance locks a question's choices, so a question revealed before being
       answered is also blank — and reporting one forfeit as both "revealed" and
       "left blank" would double-count it in the score panel. */
    if (revealedIds.has(question.id)) {
      revealedCount++;
      incorrectIndices.push(index);
      return;
    }
    const given = answers[question.id];
    if (given === undefined) {
      unansweredCount++;
      incorrectIndices.push(index);
      return;
    }
    if (given === question.answer) correctCount++;
    else incorrectIndices.push(index);
  });

  const totalCount = questions.length;
  /* Guard the empty-attempt case so a bank load failure cannot produce NaN%. */
  const percent = totalCount === 0 ? 0 : Math.round((correctCount / totalCount) * 1000) / 10;

  return {
    correctCount,
    totalCount,
    percent,
    passed: correctCount >= passingCorrect,
    incorrectIndices,
    unansweredCount,
    revealedCount,
  };
}

/** Countdown display as m:ss. Clamps negatives to 0:00. */
export function formatRemaining(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return minutes + ':' + String(seconds).padStart(2, '0');
}
