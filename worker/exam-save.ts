/**
 * Cloudflare Worker endpoint — save and resume a practice-exam attempt.
 *
 * SPR-0097. Design record: `decisions/004-real-estate-practice-exam.md`.
 * Routed from `worker/index.ts`; see `worker/README.md` for the one-time
 * Cloudflare setup (bucket, binding, lifecycle rule, rate-limit rule).
 *
 *   POST /api/exam-save          { localDate, attempt }  -> { code, saved }
 *   POST /api/exam-save/<code>   { attempt }             -> { code, saved }
 *   GET  /api/exam-save/<code>                           -> { attempt }
 *
 * One JSON object per save, in a PRIVATE R2 bucket, keyed by its resume code.
 * Private matters: the code is the only credential, so an object reachable by
 * URL would be an enumerable list of in-progress exams. Nothing outside this
 * Worker can read the bucket.
 *
 * THIS IS AN UNAUTHENTICATED WRITE ENDPOINT, which is the whole security story
 * of the feature. Two things keep it from being a free file host: the body is
 * capped before it is read, and the stored object is *rebuilt* from validated
 * fields rather than passed through. Whatever a caller sends, what lands in the
 * bucket is a `SavedAttempt` and nothing else — no unexpected keys, no
 * attacker-chosen strings beyond bank-shaped question ids.
 *
 * WHAT IS NOT STORED: the saved object carries no personal information. The
 * code is a date plus random characters, the body is bank ids and small
 * integers, and the request's IP is used for nothing — not logged, not kept,
 * not written. That is what lets the page keep saying it does not collect
 * personal data, and it is a property to preserve rather than a coincidence.
 */
import type { SavedAttempt } from '../src/lib/exam/types.ts';
import {
  isValidDatePrefix,
  mintResumeCode,
  normalizeResumeCode,
} from '../src/lib/exam/resume-code.ts';
import { json, preflight } from './http.ts';

export interface ExamSaveEnv {
  EXAM_SAVES: R2Bucket;
}

/** Saves expire two weeks after they are written. */
const RETENTION_DAYS = 14;

/**
 * Hard cap on a request body, enforced before parsing.
 *
 * A real save is around 3 KB: 75 question ids, up to 75 small integers, a
 * reveal list and a number. 16 KB leaves generous headroom and still makes the
 * endpoint useless for storing anything a person would want to store.
 */
const MAX_BODY_BYTES = 16 * 1024;

/** Ceilings for the validator. Deliberately a little above the real exam's 75,
 *  so a bank-size change does not silently start rejecting saves. */
const MAX_QUESTIONS = 120;
const MAX_QUESTION_ID_LENGTH = 64;
/** The bank's own id convention: `<topic-id>-NNNN`, lowercase. */
const QUESTION_ID_PATTERN = /^[a-z0-9][a-z0-9-]*$/;

/** 90-minute exam; allow a little slack rather than pinning to exactly 5400. */
const MAX_SECONDS_LEFT = 6 * 60 * 60;

export async function handleExamSave(request: Request, env: ExamSaveEnv): Promise<Response> {
  const origin = request.headers.get('Origin') || '';
  const url = new URL(request.url);

  if (request.method === 'OPTIONS') return preflight(origin, 'GET, POST, OPTIONS');

  /* `/api/exam-save` or `/api/exam-save/<code>`. */
  const tail = url.pathname.replace(/^\/api\/exam-save\/?/, '');

  if (request.method === 'GET') {
    if (!tail) return json({ error: 'A resume code is required.' }, 400, origin);
    return readSave(tail, env, origin);
  }

  if (request.method === 'POST') {
    return writeSave(request, tail, env, origin);
  }

  return json({ error: 'Method not allowed' }, 405, origin);
}

/* -------------------------------------------------------------------- read */

async function readSave(rawCode: string, env: ExamSaveEnv, origin: string): Promise<Response> {
  const code = normalizeResumeCode(decodeURIComponent(rawCode));
  /* Same response for "not a code" and "no such code". Distinguishing them
     would let a caller confirm which codes exist without holding one. */
  if (!code) return notFound(origin);

  const object = await env.EXAM_SAVES.get(objectKey(code));
  if (!object) return notFound(origin);

  let saved: SavedAttempt;
  try {
    saved = (await object.json()) as SavedAttempt;
  } catch {
    return notFound(origin);
  }

  /* Expire on read as well as by lifecycle rule. The bucket rule is what
     actually deletes the object, but Cloudflare only promises removal within
     24 hours of expiry — so without this, a save could still open on day
     fifteen and the page's "two weeks" would be approximately true instead of
     true. */
  if (isExpired(saved.saved)) return notFound(origin);

  return json({ attempt: saved }, 200, origin);
}

/* ------------------------------------------------------------------- write */

async function writeSave(
  request: Request,
  rawCode: string,
  env: ExamSaveEnv,
  origin: string,
): Promise<Response> {
  /* Check the declared length before reading a byte. `readBounded` below still
     enforces the cap for a chunked body that declares nothing. */
  const declared = Number(request.headers.get('Content-Length') ?? '0');
  if (declared > MAX_BODY_BYTES) return json({ error: 'That save is too large.' }, 413, origin);

  const raw = await readBounded(request, MAX_BODY_BYTES);
  if (raw === null) return json({ error: 'That save is too large.' }, 413, origin);

  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return json({ error: 'Invalid JSON body' }, 400, origin);
  }

  const body = payload as Record<string, unknown>;
  const attempt = validateAttempt(body.attempt);
  if (typeof attempt === 'string') return json({ error: attempt }, 400, origin);

  /* An existing code updates in place; no code mints a new one. That is the
     whole difference between "save" and "save again after resuming". */
  let code: string;
  if (rawCode) {
    const normalized = normalizeResumeCode(decodeURIComponent(rawCode));
    if (!normalized) return notFound(origin);
    /* Only overwrite something that is actually there, so this cannot be used
       to plant arbitrary objects at codes of the caller's choosing. */
    const existing = await env.EXAM_SAVES.head(objectKey(normalized));
    if (!existing) return notFound(origin);
    code = normalized;
  } else {
    const localDate = body.localDate;
    if (typeof localDate !== 'string' || !isValidDatePrefix(localDate)) {
      return json({ error: 'Invalid date.' }, 400, origin);
    }
    if (!isPlausibleToday(localDate)) {
      return json({ error: 'Invalid date.' }, 400, origin);
    }
    code = mintResumeCode(localDate);
  }

  const saved: SavedAttempt = {
    ...attempt,
    /* The Worker's clock, not the browser's. Retention is measured from this,
       so a client that could set it could keep a save alive indefinitely. */
    saved: new Date().toISOString(),
  };

  await env.EXAM_SAVES.put(objectKey(code), JSON.stringify(saved), {
    httpMetadata: { contentType: 'application/json' },
  });

  return json({ code, saved: saved.saved }, 200, origin);
}

/* -------------------------------------------------------------- validation */

/**
 * Validate and REBUILD the attempt. Returns a clean `SavedAttempt` minus its
 * timestamp, or a human-facing error string.
 *
 * Rebuilding rather than returning the input is the point: extra fields a
 * caller invented are dropped here rather than written to the bucket.
 */
function validateAttempt(value: unknown): Omit<SavedAttempt, 'saved'> | string {
  if (!value || typeof value !== 'object') return 'Malformed save.';
  const input = value as Record<string, unknown>;

  if (input.v !== 1) return 'Unsupported save version.';

  const bankVersion = input.bankVersion;
  if (!Number.isInteger(bankVersion) || (bankVersion as number) < 0 || (bankVersion as number) > 1e6) {
    return 'Malformed save.';
  }

  if (!Array.isArray(input.questionIds)) return 'Malformed save.';
  if (input.questionIds.length === 0 || input.questionIds.length > MAX_QUESTIONS) {
    return 'Malformed save.';
  }

  const questionIds: string[] = [];
  const seen = new Set<string>();
  for (const id of input.questionIds) {
    if (typeof id !== 'string') return 'Malformed save.';
    if (id.length === 0 || id.length > MAX_QUESTION_ID_LENGTH) return 'Malformed save.';
    if (!QUESTION_ID_PATTERN.test(id)) return 'Malformed save.';
    /* Duplicates would let one id be stored many times to inflate the object
       past what the question count implies. */
    if (seen.has(id)) return 'Malformed save.';
    seen.add(id);
    questionIds.push(id);
  }

  if (!input.answers || typeof input.answers !== 'object' || Array.isArray(input.answers)) {
    return 'Malformed save.';
  }
  const answers: Record<string, number> = {};
  for (const [id, choice] of Object.entries(input.answers as Record<string, unknown>)) {
    /* Keys must be ids from THIS attempt — that is what stops the answers map
       from being used as arbitrary key/value storage. */
    if (!seen.has(id)) return 'Malformed save.';
    if (!Number.isInteger(choice) || (choice as number) < 0 || (choice as number) > 9) {
      return 'Malformed save.';
    }
    answers[id] = choice as number;
  }

  if (!Array.isArray(input.revealed) || input.revealed.length > MAX_QUESTIONS) {
    return 'Malformed save.';
  }
  const revealed: string[] = [];
  for (const id of input.revealed) {
    if (typeof id !== 'string' || !seen.has(id)) return 'Malformed save.';
    if (!revealed.includes(id)) revealed.push(id);
  }

  const secondsLeft = input.secondsLeft;
  if (secondsLeft !== null) {
    if (
      !Number.isInteger(secondsLeft) ||
      (secondsLeft as number) < 0 ||
      (secondsLeft as number) > MAX_SECONDS_LEFT
    ) {
      return 'Malformed save.';
    }
  }

  return {
    v: 1,
    bankVersion: bankVersion as number,
    questionIds,
    answers,
    revealed,
    secondsLeft: secondsLeft as number | null,
  };
}

/* ----------------------------------------------------------------- helpers */

function objectKey(code: string): string {
  return `saves/${code}.json`;
}

function notFound(origin: string): Response {
  return json({ error: 'No saved exam found for that code.' }, 404, origin);
}

function isExpired(savedAt: string): boolean {
  const written = Date.parse(savedAt);
  if (Number.isNaN(written)) return true;
  return Date.now() - written > RETENTION_DAYS * 24 * 60 * 60 * 1000;
}

/**
 * The browser sends its own local date so the code reads as the day the
 * visitor sat the exam rather than whatever UTC thought at the time. Trusting
 * it outright would let a caller choose the object-key prefix, so allow only
 * dates within a day of the Worker's own — which covers every real timezone
 * and nothing else.
 */
function isPlausibleToday(localDate: string): boolean {
  const asUtc = Date.parse(
    `${localDate.slice(0, 4)}-${localDate.slice(4, 6)}-${localDate.slice(6, 8)}T00:00:00Z`,
  );
  if (Number.isNaN(asUtc)) return false;
  return Math.abs(Date.now() - asUtc) <= 2 * 24 * 60 * 60 * 1000;
}

/**
 * Read at most `limit` bytes, returning null if the body runs longer.
 *
 * `await request.text()` would buffer whatever arrives before anything could
 * check it, so a chunked body with no Content-Length would sail past the
 * header check above.
 */
async function readBounded(request: Request, limit: number): Promise<string | null> {
  const reader = request.body?.getReader();
  if (!reader) return '';

  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > limit) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }

  const joined = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    joined.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(joined);
}
