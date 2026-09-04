/**
 * Build-time validator for the practice exam question bank.
 *
 * SPR-0092. Run directly (`npm run validate:exam-bank`) or automatically via
 * the `prebuild` hook, so a malformed or internally inconsistent bank can never
 * reach a deploy.
 *
 * Hand-rolled rather than schema-library-based on purpose: the bank has exactly
 * one consumer and a dozen rules, several of which (topic quota arithmetic,
 * positional-choice detection, the answer-first convention) are domain rules a
 * generic schema validator would not express anyway. Avoiding a dependency also
 * keeps this runnable with nothing but `tsx`.
 *
 * Exits non-zero on any error. Warnings are printed but do not fail the build —
 * an under-filled topic pool is expected while the bank grows toward its 458
 * target, and `selectExam()` redistributes the shortfall.
 */
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { ExamBank, ExamQuestion, ExamTopic } from '../src/lib/exam/types.ts';

const REPO_ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const BANK_PATH = join(REPO_ROOT, 'public/data/ny-real-estate-questions.json');

/** DOS's 77-hour curriculum. If topic hours stop summing to this, something is wrong. */
const CURRICULUM_TOTAL_HOURS = 77;

/**
 * Choice text that only makes sense in a fixed position. `selectExam()` shuffles
 * choice order on every render, so any of these would produce a nonsense question.
 */
const POSITIONAL_CHOICE_PATTERNS = [
  /\ball of the above\b/i,
  /\bnone of the above\b/i,
  /\bboth [ab] and [bcd]\b/i,
  /\b(?:answers?|choices?) [ab] and [bcd]\b/i,
];

const errors: string[] = [];
const warnings: string[] = [];

function error(message: string): void {
  errors.push(message);
}

function warn(message: string): void {
  warnings.push(message);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function validateTopics(topics: ExamTopic[], examQuestionCount: number): Set<string> {
  const ids = new Set<string>();
  let hourSum = 0;
  let quotaSum = 0;

  for (const [index, topic] of topics.entries()) {
    const where = `topics[${index}]`;
    if (!isNonEmptyString(topic.id)) error(`${where}: missing id`);
    else if (ids.has(topic.id)) error(`${where}: duplicate topic id "${topic.id}"`);
    else ids.add(topic.id);

    if (!isNonEmptyString(topic.label)) error(`${where} (${topic.id}): missing label`);
    if (!Number.isInteger(topic.questionsPerExam) || topic.questionsPerExam < 1) {
      error(`${where} (${topic.id}): questionsPerExam must be a positive integer`);
    }
    if (typeof topic.curriculumHours !== 'number' || topic.curriculumHours <= 0) {
      error(`${where} (${topic.id}): curriculumHours must be a positive number`);
    }
    hourSum += topic.curriculumHours ?? 0;
    quotaSum += topic.questionsPerExam ?? 0;
  }

  if (hourSum !== CURRICULUM_TOTAL_HOURS) {
    error(
      `topics: curriculumHours sums to ${hourSum}, expected ${CURRICULUM_TOTAL_HOURS} ` +
        `(the DOS 77-hour qualifying curriculum)`,
    );
  }
  if (quotaSum !== examQuestionCount) {
    error(
      `topics: questionsPerExam sums to ${quotaSum}, expected ${examQuestionCount} ` +
        `(meta.examQuestionCount) — an attempt would not have the right number of questions`,
    );
  }

  return ids;
}

function validateQuestion(q: ExamQuestion, index: number, topicIds: Set<string>, seen: Set<string>): void {
  const where = `questions[${index}]${isNonEmptyString(q.id) ? ` (${q.id})` : ''}`;

  if (!isNonEmptyString(q.id)) error(`${where}: missing id`);
  else if (seen.has(q.id)) error(`${where}: duplicate question id`);
  else seen.add(q.id);

  if (!isNonEmptyString(q.topic)) error(`${where}: missing topic`);
  else if (!topicIds.has(q.topic)) error(`${where}: topic "${q.topic}" is not declared in topics[]`);
  else if (isNonEmptyString(q.id) && !q.id.startsWith(`${q.topic}-`)) {
    /* Id prefixes make the bank navigable by eye and make a mis-tagged question
       obvious in a diff. Cheap convention, worth enforcing. */
    error(`${where}: id should start with its topic id ("${q.topic}-")`);
  }

  if (!isNonEmptyString(q.prompt)) error(`${where}: missing prompt`);
  if (!isNonEmptyString(q.explanation)) error(`${where}: missing explanation`);
  if (!isNonEmptyString(q.citation)) error(`${where}: missing citation`);

  if (!Array.isArray(q.choices) || q.choices.length !== 4) {
    error(`${where}: must have exactly 4 choices, found ${Array.isArray(q.choices) ? q.choices.length : 'none'}`);
    return;
  }

  const normalized = new Set<string>();
  for (const [i, choice] of q.choices.entries()) {
    if (!isNonEmptyString(choice)) {
      error(`${where}: choice ${i} is empty`);
      continue;
    }
    const key = choice.trim().toLowerCase();
    if (normalized.has(key)) error(`${where}: choice ${i} duplicates an earlier choice`);
    else normalized.add(key);

    for (const pattern of POSITIONAL_CHOICE_PATTERNS) {
      if (pattern.test(choice)) {
        error(
          `${where}: choice ${i} is positional ("${choice.trim()}"). Choice order is ` +
            `shuffled at render time, so positional choices become nonsense.`,
        );
        break;
      }
    }
  }

  /* Authoring convention: the correct answer is always written first in the
     source. It makes reviewing 450+ questions for legal accuracy far easier —
     a reviewer reads prompt, then answer, then distractors, in that order,
     without cross-referencing an index. Randomization is the render layer's
     job: `toAttemptQuestion()` in src/lib/exam/select.ts shuffles choice order
     on every question of every attempt. */
  if (q.answer !== 0) {
    error(
      `${where}: answer must be 0. The bank's convention is that the correct ` +
        `choice is authored first; render-time shuffling randomizes position.`,
    );
  }
}

async function main(): Promise<void> {
  let bank: ExamBank;
  try {
    bank = JSON.parse(await readFile(BANK_PATH, 'utf8')) as ExamBank;
  } catch (cause) {
    console.error(`✗ Could not read or parse ${BANK_PATH}`);
    console.error(cause instanceof Error ? cause.message : cause);
    process.exit(1);
  }

  const { meta, topics, questions } = bank;

  if (!meta || !Number.isInteger(meta.examQuestionCount) || meta.examQuestionCount < 1) {
    error('meta.examQuestionCount must be a positive integer');
  }
  if (!meta || !Number.isInteger(meta.passingCorrect) || meta.passingCorrect < 1) {
    error('meta.passingCorrect must be a positive integer');
  } else if (meta.passingCorrect > meta.examQuestionCount) {
    error('meta.passingCorrect exceeds meta.examQuestionCount — the exam would be unpassable');
  }
  if (!isNonEmptyString(meta?.sourceNote)) {
    error('meta.sourceNote is required — it carries the provenance disclaimer shown on the page');
  }

  if (!Array.isArray(topics) || topics.length === 0) {
    error('topics[] is missing or empty');
  }
  if (!Array.isArray(questions) || questions.length === 0) {
    error('questions[] is missing or empty');
  }

  if (errors.length > 0) {
    report(0);
    return;
  }

  const topicIds = validateTopics(topics, meta.examQuestionCount);
  const seenQuestionIds = new Set<string>();
  for (const [index, question] of questions.entries()) {
    validateQuestion(question, index, topicIds, seenQuestionIds);
  }

  /* Pool depth per topic. Below quota is survivable — selectExam() backfills
     from other topics — but it skews the subject mix, so it's worth saying. */
  const counts = new Map<string, number>();
  for (const q of questions) counts.set(q.topic, (counts.get(q.topic) ?? 0) + 1);

  console.log('Topic pools (questions in bank / needed per attempt):');
  for (const topic of topics) {
    const have = counts.get(topic.id) ?? 0;
    const flag = have === 0 ? ' ✗' : have < topic.questionsPerExam ? ' !' : '';
    console.log(
      `  ${topic.id.padEnd(28)} ${String(have).padStart(4)} / ${String(topic.questionsPerExam).padStart(2)}${flag}`,
    );
    if (have === 0) {
      error(`topic "${topic.id}" has no questions at all`);
    } else if (have < topic.questionsPerExam) {
      warn(
        `topic "${topic.id}" has ${have} question(s) but needs ${topic.questionsPerExam} per attempt; ` +
          `the shortfall will be backfilled from other topics, skewing the subject mix`,
      );
    }
  }

  const totalNeeded = topics.reduce((sum, t) => sum + t.questionsPerExam, 0);
  console.log(`\nBank total: ${questions.length} questions across ${topics.length} topics.`);
  if (questions.length < totalNeeded) {
    error(`bank holds ${questions.length} questions but an attempt needs ${totalNeeded}`);
  }

  reportAnswerLengthBias(questions);

  report(questions.length);
}

/**
 * Guard against the single most common flaw in a hand-authored multiple-choice
 * bank: the correct answer being conspicuously longer than its distractors.
 *
 * It happens naturally, because a correct answer tends to state the full rule
 * with its qualifications while wrong answers stay terse. The consequence is a
 * bank a candidate can beat without knowing the material — simply picking the
 * longest choice every time. This bank measured 60.7% on that strategy before
 * the SPR-0093 rebalancing pass and 32.2% after, against a 25% random baseline.
 *
 * Two signals are reported. The per-question ratio catches individual
 * offenders; the whole-bank "pick the longest" score catches the aggregate
 * drift that no single question would flag.
 */
function reportAnswerLengthBias(questions: ExamQuestion[]): void {
  /** Correct answer this many times the mean distractor length is a visible tell. */
  const RATIO_LIMIT = 1.6;
  /** Whole-bank ceiling for the pick-the-longest strategy before it is a real weakness. */
  const STRATEGY_LIMIT = 0.4;

  const offenders: string[] = [];
  let strategyScore = 0;

  for (const q of questions) {
    const lengths = q.choices.map((c) => c.length);
    const meanDistractor = (lengths.slice(1).reduce((a, b) => a + b, 0)) / (lengths.length - 1);
    if (meanDistractor > 0 && lengths[0] / meanDistractor >= RATIO_LIMIT) {
      offenders.push(`${q.id} (${(lengths[0] / meanDistractor).toFixed(2)}x)`);
    }
    /* Credit ties proportionally — three choices tied for longest give a
       guesser a one-in-three chance, not a certainty. */
    const longest = Math.max(...lengths);
    const tied = lengths.filter((l) => l === longest).length;
    if (lengths[0] === longest) strategyScore += 1 / tied;
  }

  const pct = strategyScore / questions.length;
  console.log(
    `Answer-length bias: pick-the-longest scores ${(pct * 100).toFixed(1)}% ` +
      `(random 25%, limit ${STRATEGY_LIMIT * 100}%).`,
  );

  if (offenders.length > 0) {
    warn(
      `${offenders.length} question(s) have a correct answer >= ${RATIO_LIMIT}x the mean ` +
        `distractor length: ${offenders.slice(0, 8).join(', ')}` +
        `${offenders.length > 8 ? ', …' : ''}`,
    );
  }
  if (pct > STRATEGY_LIMIT) {
    error(
      `pick-the-longest strategy scores ${(pct * 100).toFixed(1)}%, above the ` +
        `${STRATEGY_LIMIT * 100}% limit — the bank is guessable without knowing the material. ` +
        `Lengthen distractors or trim qualifying clauses out of correct answers.`,
    );
  }
}

function report(questionCount: number): void {
  for (const message of warnings) console.warn(`! ${message}`);
  if (errors.length > 0) {
    console.error(`\n✗ Exam bank validation failed with ${errors.length} error(s):`);
    for (const message of errors) console.error(`  - ${message}`);
    process.exit(1);
  }
  console.log(
    `✓ Exam bank valid${questionCount ? ` (${questionCount} questions)` : ''}` +
      `${warnings.length ? `, ${warnings.length} warning(s)` : ''}.`,
  );
}

await main();
