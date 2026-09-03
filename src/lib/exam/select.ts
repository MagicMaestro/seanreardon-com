/**
 * Stratified question selection for the practice exam.
 *
 * SPR-0092. Design spec: `decisions/real-estate-practice-exam.md`.
 *
 * The 75 questions in an attempt are NOT drawn uniformly from the bank. They're
 * stratified by DOS's own curriculum hour weights, so the subject mix mirrors
 * the real exam's shape (11 Law of Agency, 9 Legal Issues, 9 Commercial, ...,
 * 1 Real Estate Mathematics). Uniform random would let the mix drift with
 * however many questions each topic happens to have authored, and a single
 * draw could come out badly skewed. Selection is still random — it's random
 * *within* each subject.
 *
 * Two properties this module guarantees:
 *
 *   1. SHORTFALL TOLERANCE. If a topic holds fewer questions than its quota
 *      (true while the bank is still being written out to its 458 target), the
 *      draw takes everything that topic has and backfills the deficit from the
 *      rest of the bank. The page works correctly at every bank size.
 *
 *   2. RETAKE FRESHNESS. Questions drawn earlier in the same page session are
 *      deprioritized, so consecutive retakes share as few items as possible.
 *      This is in-memory only — no localStorage, no sessionStorage. Navigating
 *      away loses it, which is the specified behavior.
 */
import type { AttemptQuestion, ExamAttempt, ExamBank, ExamQuestion } from './types.ts';

/**
 * Fisher-Yates, on a copy. `Math.random()` is fine here — this is a study aid,
 * not a security boundary, and `crypto.getRandomValues` would buy nothing.
 */
function shuffle<T>(items: readonly T[]): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Split a pool into (unseen, seen), each independently shuffled, then
 * concatenate. Drawing off the front of the result takes every unseen question
 * before it reaches for a repeat.
 */
function unseenFirst(pool: readonly ExamQuestion[], seenIds: ReadonlySet<string>): ExamQuestion[] {
  const unseen: ExamQuestion[] = [];
  const seen: ExamQuestion[] = [];
  for (const q of pool) {
    if (seenIds.has(q.id)) seen.push(q);
    else unseen.push(q);
  }
  return [...shuffle(unseen), ...shuffle(seen)];
}

/** Shuffle a question's four choices and re-index `answer` into the new order. */
function toAttemptQuestion(q: ExamQuestion, topicLabel: string): AttemptQuestion {
  const order = shuffle(q.choices.map((_, i) => i));
  return {
    id: q.id,
    topic: q.topic,
    topicLabel,
    prompt: q.prompt,
    shuffledChoices: order.map((i) => q.choices[i]),
    answer: order.indexOf(q.answer),
    explanation: q.explanation,
    citation: q.citation,
  };
}

/**
 * Decide whether `seenIds` is still usable for this draw.
 *
 * Honoring it only helps while enough unseen questions remain to fill a whole
 * exam. Past that point it degrades to "every question is seen", which is the
 * same as ignoring it — so we drop it and start the freshness cycle over.
 * Returned rather than mutated so the caller's state stays in its own hands.
 */
export function shouldResetSeen(bank: ExamBank, seenIds: ReadonlySet<string>): boolean {
  const remaining = bank.questions.length - seenIds.size;
  return remaining < bank.meta.examQuestionCount;
}

/**
 * Draw one attempt: `meta.examQuestionCount` questions, stratified by topic
 * quota, shuffled into a mixed order, each with its choices shuffled.
 *
 * @param bank    The validated question bank.
 * @param seenIds Bank ids already drawn this session. Deprioritized, not excluded.
 */
export function selectExam(bank: ExamBank, seenIds: ReadonlySet<string> = new Set()): ExamAttempt {
  const effectiveSeen = shouldResetSeen(bank, seenIds) ? new Set<string>() : seenIds;

  const labelById = new Map(bank.topics.map((t) => [t.id, t.label]));
  const byTopic = new Map<string, ExamQuestion[]>();
  for (const q of bank.questions) {
    const bucket = byTopic.get(q.topic);
    if (bucket) bucket.push(q);
    else byTopic.set(q.topic, [q]);
  }

  const picked: ExamQuestion[] = [];
  const pickedIds = new Set<string>();
  /* Leftovers from every topic, for the backfill pass below. */
  const leftovers: ExamQuestion[] = [];

  for (const topic of bank.topics) {
    const ordered = unseenFirst(byTopic.get(topic.id) ?? [], effectiveSeen);
    const take = Math.min(topic.questionsPerExam, ordered.length);
    for (let i = 0; i < ordered.length; i++) {
      if (i < take) {
        picked.push(ordered[i]);
        pickedIds.add(ordered[i].id);
      } else {
        leftovers.push(ordered[i]);
      }
    }
  }

  /* Backfill. Any topic that could not meet its quota leaves a deficit; fill it
     from the rest of the bank. Taking randomly from the combined leftovers is
     inherently proportional to each topic's surplus, which is the behavior we
     want — the topics with the most spare questions absorb the most of it. */
  const deficit = bank.meta.examQuestionCount - picked.length;
  if (deficit > 0 && leftovers.length > 0) {
    for (const q of unseenFirst(leftovers, effectiveSeen).slice(0, deficit)) {
      picked.push(q);
      pickedIds.add(q.id);
    }
  }

  const questions = shuffle(picked).map((q) =>
    toAttemptQuestion(q, labelById.get(q.topic) ?? q.topic),
  );

  return { questions, drawnIds: [...pickedIds] };
}
