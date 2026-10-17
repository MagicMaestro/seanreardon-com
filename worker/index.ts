/**
 * Worker entrypoint — routes `/api/*` to the handler that owns each path.
 *
 * SPR-0097. Added when `/api/exam-save` joined `/api/contact` on the same
 * Worker. One Worker rather than two because it is one `wrangler deploy`, one
 * set of routes and one origin allowlist to keep straight; the endpoints share
 * nothing else and live in their own modules.
 *
 * `contact-form.ts` is delegated to unchanged, default export and all. It is
 * live production functionality whose end-to-end path needs the real Turnstile
 * and Resend secrets to exercise, so this PR routes around it rather than
 * refactoring it. See the note in `http.ts` about the duplicated helpers that
 * leaves behind.
 */
import contactForm from './contact-form.ts';
import { handleExamSave, type ExamSaveEnv } from './exam-save.ts';

/** Every binding either endpoint needs. Each handler takes the slice it uses;
 *  structural typing means passing the whole thing satisfies both. */
export interface Env extends ExamSaveEnv {
  TURNSTILE_SECRET_KEY: string;
  RESEND_API_KEY: string;
  CONTACT_DESTINATION_EMAIL: string;
  CONTACT_FROM_EMAIL: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(request.url);

    if (pathname === '/api/exam-save' || pathname.startsWith('/api/exam-save/')) {
      return handleExamSave(request, env);
    }

    /* Everything else on the Worker's routes is the contact form, which was
       here first and still owns its own 404 behavior. */
    return contactForm.fetch(request, env);
  },
};
