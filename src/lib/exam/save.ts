/**
 * Translating an in-progress attempt to and from its saved form.
 *
 * SPR-0097. Design record: `decisions/004-real-estate-practice-exam.md`.
 *
 * This module exists for one reason. The component holds answers in *display*
 * coordinates — "the visitor picked the second radio button" — and the display
 * order is reshuffled every time an attempt is built. Storing that index would
 * produce a save that restores to different answers than the ones given, and
 * it would do it silently: every id would resolve, every question would show a
 * selection, and roughly three in four of them would be the wrong one. Nothing
 * in the UI could reveal the fault, because nothing in the UI remembers what
 * was picked before.
 *
 * So the boundary translates. On the way out, a display index becomes the bank
 * index it refers to; on the way back, the bank index is found in the fresh
 * shuffle. `AttemptQuestion.choiceOrder` is the dictionary for both directions.
 */
import type {
  ExamAttempt,
  ExamBank,
  ExamQuestion,
  RestoredAttempt,
  SavedAttempt,
} from './types.ts';
import { toAttemptQuestion } from './select.ts';

/** Fields the browser sends. `saved` is set by the Worker, from its own clock —
 *  a timestamp the client could choose is not a timestamp. */
export type SaveRequestBody = Omit<SavedAttempt, 'saved'>;

/**
 * Pack the live attempt into its saved form.
 *
 * @param attempt     The attempt as drawn, in display order.
 * @param answers     Selected **display** choice index per question id.
 * @param revealedIds Questions whose answer was revealed, and so forfeited.
 * @param secondsLeft Countdown remaining, or null if the timer never started.
 * @param bankVersion `ExamMeta.version`, recorded so a restore can tell the
 *                    visitor the bank moved under them.
 */
export function toSaveRequestBody(
  attempt: ExamAttempt,
  answers: Readonly<Record<string, number>>,
  revealedIds: ReadonlySet<string>,
  secondsLeft: number | null,
  bankVersion: number,
): SaveRequestBody {
  const packed: Record<string, number> = {};

  for (const question of attempt.questions) {
    const displayIndex = answers[question.id];
    if (displayIndex === undefined) continue;
    const bankIndex = question.choiceOrder[displayIndex];
    /* Guard rather than assert. A display index with no entry in choiceOrder
       would mean the component and the attempt had disagreed about how many
       choices a question has, and dropping the answer is a far better failure
       than writing `undefined` into the saved object. */
    if (bankIndex === undefined) continue;
    packed[question.id] = bankIndex;
  }

  return {
    v: 1,
    bankVersion,
    questionIds: attempt.questions.map((question) => question.id),
    answers: packed,
    /* Only ids actually in this attempt, so a stale reveal can never travel. */
    revealed: attempt.questions
      .map((question) => question.id)
      .filter((id) => revealedIds.has(id)),
    secondsLeft,
  };
}

/**
 * Rebuild an attempt from a saved object against the bank as it is now.
 *
 * Questions the bank no longer holds are dropped and reported rather than
 * faked. In the two weeks a save can live, the bank may have been edited for
 * legal accuracy — and a restored exam that quietly got shorter, or that showed
 * a question whose text had changed under its own saved answer, would be worse
 * than one that says what happened.
 */
export function restoreExam(bank: ExamBank, saved: SavedAttempt): RestoredAttempt {
  const byId = new Map<string, ExamQuestion>(bank.questions.map((q) => [q.id, q]));
  const labelById = new Map(bank.topics.map((topic) => [topic.id, topic.label]));

  const questions = [];
  const missingIds: string[] = [];

  for (const id of saved.questionIds) {
    const question = byId.get(id);
    if (!question) {
      missingIds.push(id);
      continue;
    }
    questions.push(toAttemptQuestion(question, labelById.get(question.topic) ?? question.topic));
  }

  const resolvedIds = new Set(questions.map((question) => question.id));

  /* Bank index back to display index, through this restore's fresh shuffle. */
  const answers: Record<string, number> = {};
  for (const question of questions) {
    const bankIndex = saved.answers[question.id];
    if (bankIndex === undefined) continue;
    const displayIndex = question.choiceOrder.indexOf(bankIndex);
    /* -1 means the saved index is not a choice this question has any more —
       the question was edited down to fewer choices. Treat it as unanswered
       rather than guessing which of the survivors was meant. */
    if (displayIndex === -1) continue;
    answers[question.id] = displayIndex;
  }

  return {
    attempt: { questions, drawnIds: [...resolvedIds] },
    answers,
    revealedIds: new Set(saved.revealed.filter((id) => resolvedIds.has(id))),
    secondsLeft: saved.secondsLeft,
    missingIds,
    bankChanged: saved.bankVersion !== bank.meta.version,
  };
}

/**
 * Seconds to put back on the clock when resuming a timed attempt.
 *
 * Sean's rule: hand back three minutes on top of what was left, as a buffer for
 * getting reacclimated, but never let a resume end up with more time than the
 * exam allows in the first place.
 */
export function resumeSeconds(
  savedSeconds: number | null,
  timeLimitMinutes: number,
): number | null {
  if (savedSeconds === null) return null;
  const ceiling = timeLimitMinutes * 60;
  return Math.min(Math.max(0, savedSeconds) + 180, ceiling);
}
