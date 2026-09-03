/**
 * Type definitions for the NY real estate salesperson practice exam.
 *
 * SPR-0092. Authoritative design spec lives in
 * `decisions/real-estate-practice-exam.md` (planning project).
 *
 * The question bank is authored by hand as `public/data/ny-real-estate-questions.json`,
 * validated at build time by `scripts/validate-exam-bank.ts` (wired as `prebuild`),
 * and fetched at runtime by the `PracticeExam` island. It deliberately does NOT
 * go through a content collection or a bundled `import`: at the ~458-question
 * target the bank is ~210KB, which would either bloat the island chunk or get
 * serialized into the page HTML as island props. `public/search-index.json` is
 * the existing precedent for large structured JSON living in `public/`.
 *
 * PROVENANCE — every question in the bank is original work, written from public
 * sources only: the NY DOS 77-hour salesperson qualifying curriculum
 * (eff. 12/21/2022), Real Property Law Article 12-A, and 19 NYCRR Part 175.
 * No third-party question bank was consulted. Legal rules are facts and are not
 * copyrightable; the specific expression of a competitor's question is. The
 * mandatory `citation` field on every question is both a study aid and
 * documentation of independent creation.
 */

/** Stable topic identifier. Matches the 19 subjects of the DOS 77-hour curriculum. */
export type TopicId = string;

/**
 * One of the 19 curriculum subjects.
 *
 * `curriculumHours` is DOS's own hour allocation (sums to 77 across all topics).
 * `questionsPerExam` is this app's per-attempt quota (sums to
 * `meta.examQuestionCount`, i.e. 75). The mapping rule is one question per
 * curriculum hour, minus one each from the two 10-hour subjects to land on 75 —
 * Law of Agency keeps its full 11 as the single largest subject.
 *
 * Standard largest-remainder apportionment was rejected: it paradoxically drops
 * Law of Agency (11 hrs) to 10 while a 10-hour subject also keeps 10, which
 * reads as a bug to anyone checking the table.
 */
export interface ExamTopic {
  id: TopicId;
  /** Human-facing subject name, as DOS writes it in the curriculum. */
  label: string;
  /** DOS's hour allocation for this subject. All 19 sum to 77. */
  curriculumHours: number;
  /** How many questions this subject contributes to one 75-question attempt. */
  questionsPerExam: number;
}

/**
 * A single bank question.
 *
 * `choices` is always exactly 4 and `answer` indexes into it. Choice order is
 * shuffled per render, so authored choices must never include positional text
 * ("All of the above", "None of the above", "Both A and B"). The validator
 * rejects those outright.
 */
export interface ExamQuestion {
  /** Unique across the bank. Format: `<topic-id>-NNNN`. */
  id: string;
  topic: TopicId;
  /** The question stem. Plain text — rendered as-is, no markup. */
  prompt: string;
  /** Exactly four answer choices. */
  choices: string[];
  /** Index into `choices` of the correct answer. 0-3. */
  answer: number;
  /** One or two sentences on why the answer is right. Shown after submit. */
  explanation: string;
  /** Statute / regulation / curriculum section the rule comes from. */
  citation: string;
}

/** Exam-wide constants, carried in the bank so the app has a single source of truth. */
export interface ExamMeta {
  version: number;
  /** ISO date the bank was last reviewed against current law. */
  updated: string;
  /** Questions drawn per attempt. 75 by prep-industry convention (NOT a DOS-published figure). */
  examQuestionCount: number;
  /** Correct answers needed to pass: ceil(0.70 * 75) = 53. */
  passingCorrect: number;
  /** DOS-published time limit, in minutes. Officially sourced. */
  timeLimitMinutes: number;
  /** Human-readable provenance statement, surfaced in the page's disclaimer. */
  sourceNote: string;
}

/** The whole bank, as `public/data/ny-real-estate-questions.json` deserializes. */
export interface ExamBank {
  meta: ExamMeta;
  topics: ExamTopic[];
  questions: ExamQuestion[];
}

/**
 * A question as presented in one attempt — the bank question plus this
 * attempt's shuffled choice order.
 *
 * `shuffledChoices` holds the display order; `answer` is re-indexed to point
 * into it, so consumers never need the original bank ordering.
 */
export interface AttemptQuestion {
  /** The bank question id, for de-duplication across retakes in the same session. */
  id: string;
  topic: TopicId;
  /** Human-facing subject name, denormalized so cards can label themselves. */
  topicLabel: string;
  prompt: string;
  /** Choices in this attempt's display order. */
  shuffledChoices: string[];
  /** Index into `shuffledChoices` of the correct answer. */
  answer: number;
  explanation: string;
  citation: string;
}

/** One drawn exam, ready to render. */
export interface ExamAttempt {
  questions: AttemptQuestion[];
  /** Bank ids drawn this attempt — fed back into the next draw to prefer unseen questions. */
  drawnIds: string[];
}

/**
 * Result of grading a submitted attempt.
 *
 * Unanswered questions count as incorrect, matching the real exam.
 */
export interface ExamResult {
  correctCount: number;
  totalCount: number;
  /** 0-100, one decimal place. A study aid only — the real exam reports pass/fail with no score. */
  percent: number;
  passed: boolean;
  /** Indices into `attempt.questions` that were answered incorrectly or left blank, in exam order. */
  incorrectIndices: number[];
  /** How many were left blank. Surfaced separately so the score block can call it out. */
  unansweredCount: number;
}
