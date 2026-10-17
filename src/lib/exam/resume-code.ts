/**
 * Resume codes for saved practice-exam attempts.
 *
 * SPR-0097. Design record: `decisions/004-real-estate-practice-exam.md`.
 *
 * Shape: `YYYYMMDD` + eight random characters, shown hyphenated.
 *
 *     20260113-K7R4Q2X9
 *
 * The date is the visitor's local date and is there to be human-readable — it
 * tells them which sitting a code belongs to without opening it. It carries no
 * uniqueness burden at all; the eight random characters do that alone.
 *
 * WHAT THIS FORMAT REPLACED, AND WHY IT MATTERS. The first design built the
 * code out of the visitor's initials and the day of the month they were born.
 * That made it memorable, and it also made every stored object personal data
 * (initials + partial date of birth + a set of exam answers is a
 * quasi-identifier), put a weak identifier in a bearer token anyone who knew
 * the person could guess in about thirty-one tries, and required a per-day
 * counter to disambiguate two people who happened to share both. Dropping the
 * identity components removed all three at once — including the counter, and
 * with it the list-then-write race that was the strongest argument for using a
 * database rather than one object per save.
 *
 * Alphabet is Crockford base32: no I, L, O or U. The first three go because a
 * code is meant to be written on paper and typed back a week later, and 1/I/l
 * and 0/O are where that goes wrong; U goes because excluding it is what keeps
 * the alphabet from spelling things. Eight characters is 40 bits (~1.1e12),
 * which is not guessable by a rate-limited attacker who gains an exam in
 * progress for the trouble.
 *
 * Imported by BOTH the browser island and the `exam-save` Worker, so it must
 * stay free of DOM and Node APIs. `crypto.getRandomValues` is available in
 * both; `Math.random` would not be appropriate here, because unlike the
 * question shuffle this value IS a security boundary.
 */

/** Crockford base32 — digits plus the consonant-heavy letter set. 32 symbols. */
export const RESUME_CODE_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

/** Random characters after the date. Eight gives 40 bits. */
export const RESUME_SUFFIX_LENGTH = 8;

/** Canonical stored form: eight date digits followed by the suffix, no separator. */
const CANONICAL_PATTERN = /^[0-9]{8}[0-9A-Z]{8}$/;

/** A plausible `YYYYMMDD`. Range-checked, not calendar-checked — a 31st of
 *  February would pass, and costs nothing, because this field is decoration. */
export function isValidDatePrefix(value: string): boolean {
  if (!/^[0-9]{8}$/.test(value)) return false;
  const month = Number(value.slice(4, 6));
  const day = Number(value.slice(6, 8));
  const year = Number(value.slice(0, 4));
  return year >= 2020 && year <= 2100 && month >= 1 && month <= 12 && day >= 1 && day <= 31;
}

/**
 * Mint a code for a save. Called by the Worker, never by the browser — a
 * client that chose its own key could overwrite someone else's save by
 * choosing theirs.
 *
 * `byte % 32` is uniform here rather than merely close to it: 256 divides
 * evenly by 32, so there is no modulo bias to reject-sample away.
 */
export function mintResumeCode(dateYYYYMMDD: string): string {
  const bytes = new Uint8Array(RESUME_SUFFIX_LENGTH);
  crypto.getRandomValues(bytes);
  let suffix = '';
  for (const byte of bytes) suffix += RESUME_CODE_ALPHABET[byte % RESUME_CODE_ALPHABET.length];
  return dateYYYYMMDD + suffix;
}

/**
 * Accept a code the way a person would actually type it back, and return the
 * canonical form — or null if it is not one of ours.
 *
 * Tolerated: lowercase, spaces, hyphens, and the four characters the alphabet
 * leaves out, mapped the way Crockford specifies (O to zero, I and L to one).
 * Someone reading their own handwriting is exactly who those substitutions are
 * for, and refusing their code on a transcription they could not have avoided
 * is the worst moment this feature has.
 */
export function normalizeResumeCode(raw: string): string | null {
  const cleaned = raw
    .toUpperCase()
    .replace(/[\s-]/g, '')
    .replace(/O/g, '0')
    .replace(/[IL]/g, '1');
  if (!CANONICAL_PATTERN.test(cleaned)) return null;
  if (!isValidDatePrefix(cleaned.slice(0, 8))) return null;
  /* The suffix must be spellable in the alphabet. The substitutions above can
     only produce characters that are, so this catches the rest. */
  for (const character of cleaned.slice(8)) {
    if (!RESUME_CODE_ALPHABET.includes(character)) return null;
  }
  return cleaned;
}

/** Display form. The hyphen is presentation only and is stripped on input. */
export function formatResumeCode(code: string): string {
  return `${code.slice(0, 8)}-${code.slice(8)}`;
}

/**
 * The visitor's local date as `YYYYMMDD`.
 *
 * Deliberately local rather than UTC: a code minted at 9pm Eastern on the 13th
 * should say the 13th, which is the day the person remembers sitting the exam.
 * The browser sends this and the Worker sanity-checks it against its own clock
 * rather than trusting it, since it ends up in the object key.
 */
export function todayLocalDate(now: Date = new Date()): string {
  const year = String(now.getFullYear()).padStart(4, '0');
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return year + month + day;
}
