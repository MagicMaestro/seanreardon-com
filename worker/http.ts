/**
 * Shared HTTP helpers for the Worker's endpoints.
 *
 * SPR-0097. Extracted when `/api/exam-save` was added alongside `/api/contact`,
 * so the two do not each carry their own idea of which origins are ours.
 *
 * NOTE: `contact-form.ts` still has private copies of `ALLOWED_ORIGINS`,
 * `corsHeaders`, `preflight` and `json` that predate this module and are
 * identical to these. They were deliberately left in place for this PR —
 * consolidating them means editing the live contact endpoint in a change that
 * cannot be end-to-end tested without the production Turnstile and Resend
 * secrets, which is not a trade worth making for tidiness. Fold them in next
 * time that file is open for a reason of its own, and delete this note.
 */

export const ALLOWED_ORIGINS = [
  'https://seanreardon.com',
  'https://staging.seanreardon.com',
  'http://localhost:4321',
];

export function corsHeaders(origin: string): Record<string, string> {
  if (ALLOWED_ORIGINS.includes(origin)) {
    return {
      'Access-Control-Allow-Origin': origin,
      Vary: 'Origin',
    };
  }
  return {};
}

export function preflight(origin: string, methods: string): Response {
  if (!ALLOWED_ORIGINS.includes(origin)) {
    return new Response(null, { status: 403 });
  }
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': methods,
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
      Vary: 'Origin',
    },
  });
}

export function json(body: unknown, status: number, origin: string): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      /* Saves are per-code and short-lived; an intermediary holding one would
         hand a stale attempt back to the only person who wanted the fresh one. */
      'Cache-Control': 'no-store',
      ...corsHeaders(origin),
    },
  });
}
