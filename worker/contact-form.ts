/**
 * Cloudflare Worker — contact form endpoint.
 *
 * Routes (configured in wrangler.toml):
 *   - seanreardon.com/api/contact*
 *   - staging.seanreardon.com/api/contact*
 *
 * Flow:
 *   1. POST arrives with JSON form payload + Cloudflare Turnstile token
 *   2. Honeypot check — silently fake success if tripped (don't tell the bot)
 *   3. Server-side field validation (don't trust client-side validation alone)
 *   4. Verify Turnstile token with Cloudflare (and check hostname is in our allow-list)
 *   5. Send two emails via Resend:
 *      - Notification to sean@seanreardon.com
 *      - Confirmation to the submitter
 *   6. Return JSON { ok: true } or { error: "..." }
 *
 * Why Turnstile (not reCAPTCHA):
 *   - Cookieless / no fingerprinting in default mode — aligns with the rest of this
 *     site's privacy-respecting stack (CF Web Analytics, no third-party trackers).
 *   - Free, no rate limits relevant to this form's volume.
 *   - Already in our stack (we're on CF for analytics, images, DNS, and Workers).
 *
 * Environment:
 *   Vars (in wrangler.toml [vars]):
 *     CONTACT_DESTINATION_EMAIL — where the notification lands
 *     CONTACT_FROM_EMAIL        — Resend-verified domain address used in From: headers
 *   Secrets (set via `wrangler secret put`):
 *     TURNSTILE_SECRET_KEY      — CF Turnstile secret (paired with PUBLIC site key on the form)
 *     RESEND_API_KEY            — Resend REST API key (separate from Listmonk's SMTP creds)
 */

export interface Env {
  TURNSTILE_SECRET_KEY: string;
  RESEND_API_KEY: string;
  CONTACT_DESTINATION_EMAIL: string;
  CONTACT_FROM_EMAIL: string;
}

interface ContactPayload {
  fname?: string;
  lname?: string;
  email?: string;
  website?: string;
  topic?: string;
  message?: string;
  turnstile_token?: string;
  hp_website?: string;
}

const ALLOWED_ORIGINS = [
  'https://seanreardon.com',
  'https://staging.seanreardon.com',
  'http://localhost:4321',
];

// Turnstile reports the hostname that issued the token. Defense-in-depth: even if
// our site key were registered for additional domains, we reject tokens whose
// hostname isn't one we expect to see traffic from.
const ALLOWED_TURNSTILE_HOSTNAMES = [
  'seanreardon.com',
  'staging.seanreardon.com',
  'localhost',
];

const TOPIC_LABELS: Record<string, string> = {
  general: 'General inquiry',
  project: 'Project question or collaboration',
  privacy: 'Privacy request',
};

const NAME_PATTERN = /^[A-Za-z\s'-]{1,50}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = request.headers.get('Origin') || '';

    if (request.method === 'OPTIONS') {
      return preflight(origin);
    }

    if (request.method !== 'POST') {
      return json({ error: 'Method not allowed' }, 405, origin);
    }

    let payload: ContactPayload;
    try {
      payload = await request.json();
    } catch {
      return json({ error: 'Invalid JSON body' }, 400, origin);
    }

    // Honeypot — silently fake success so bots don't learn they were caught.
    if (payload.hp_website) {
      return json({ ok: true }, 200, origin);
    }

    const validationError = validate(payload);
    if (validationError) {
      return json({ error: validationError }, 400, origin);
    }

    const turnstile = await verifyTurnstile(
      payload.turnstile_token!,
      env.TURNSTILE_SECRET_KEY,
      request.headers.get('CF-Connecting-IP') || undefined,
    );
    if (!turnstile.success) {
      return json(
        { error: "Couldn't verify the challenge token. Please refresh and try again." },
        400,
        origin,
      );
    }
    if (turnstile.hostname && !ALLOWED_TURNSTILE_HOSTNAMES.includes(turnstile.hostname)) {
      return json(
        { error: 'Token issued for an unexpected hostname.' },
        400,
        origin,
      );
    }

    try {
      await Promise.all([
        sendNotification(payload as Required<ContactPayload>, env),
        sendConfirmation(payload as Required<ContactPayload>, env),
      ]);
    } catch (err) {
      console.error('Resend failure:', err);
      return json(
        { error: "Couldn't send the message. Please try again or email sean@seanreardon.com directly." },
        500,
        origin,
      );
    }

    return json({ ok: true }, 200, origin);
  },
};

function validate(p: ContactPayload): string | null {
  if (!p.fname || !NAME_PATTERN.test(p.fname.trim())) {
    return 'First name is required (letters, spaces, hyphens, apostrophes only; max 50 chars).';
  }
  if (!p.lname || !NAME_PATTERN.test(p.lname.trim())) {
    return 'Last name is required (letters, spaces, hyphens, apostrophes only; max 50 chars).';
  }
  if (!p.email || !EMAIL_PATTERN.test(p.email.trim())) {
    return 'A valid email address is required.';
  }
  if (p.website && p.website.length > 200) {
    return 'Website URL is too long (max 200 chars).';
  }
  if (!p.topic || !TOPIC_LABELS[p.topic]) {
    return 'Please choose a topic from the dropdown.';
  }
  if (!p.message || p.message.trim().length < 10) {
    return 'Message must be at least 10 characters.';
  }
  if (p.message.length > 5000) {
    return 'Message must be 5000 characters or fewer.';
  }
  if (!p.turnstile_token) {
    return 'Missing Turnstile token. Please refresh the page and try again.';
  }
  return null;
}

interface TurnstileResult {
  success: boolean;
  hostname?: string;
  action?: string;
  cdata?: string;
  challenge_ts?: string;
  'error-codes'?: string[];
}

async function verifyTurnstile(
  token: string,
  secret: string,
  remoteIp?: string,
): Promise<TurnstileResult> {
  const body = new URLSearchParams({ secret, response: token });
  if (remoteIp) body.append('remoteip', remoteIp);

  const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  return (await response.json()) as TurnstileResult;
}

async function sendNotification(p: Required<ContactPayload>, env: Env): Promise<void> {
  const topicLabel = TOPIC_LABELS[p.topic] || p.topic;
  const websiteNormalized = p.website ? normalizeUrl(p.website) : '';

  const text = [
    `New contact form submission`,
    ``,
    `Topic: ${topicLabel}`,
    `Name: ${p.fname} ${p.lname}`,
    `Email: ${p.email}`,
    websiteNormalized ? `Website: ${websiteNormalized}` : '',
    ``,
    `Message:`,
    p.message,
    '',
  ]
    .filter((line) => line !== '')
    .join('\n');

  const html = `
<p><strong>New contact form submission</strong></p>
<p>
  <strong>Topic:</strong> ${escapeHtml(topicLabel)}<br>
  <strong>Name:</strong> ${escapeHtml(p.fname)} ${escapeHtml(p.lname)}<br>
  <strong>Email:</strong> <a href="mailto:${escapeHtml(p.email)}">${escapeHtml(p.email)}</a>${
    websiteNormalized
      ? `<br><strong>Website:</strong> <a href="${escapeHtml(websiteNormalized)}" rel="noopener noreferrer">${escapeHtml(websiteNormalized)}</a>`
      : ''
  }
</p>
<p><strong>Message:</strong></p>
<p style="white-space: pre-wrap;">${escapeHtml(p.message)}</p>
`.trim();

  await resendSend(env, {
    from: `Contact Form <${env.CONTACT_FROM_EMAIL}>`,
    to: env.CONTACT_DESTINATION_EMAIL,
    reply_to: p.email,
    subject: `[${topicLabel}] Contact form: ${p.fname} ${p.lname}`,
    text,
    html,
  });
}

async function sendConfirmation(p: Required<ContactPayload>, env: Env): Promise<void> {
  const topicLabel = TOPIC_LABELS[p.topic] || p.topic;

  const text = [
    `Hi ${p.fname},`,
    ``,
    `Thanks for reaching out via seanreardon.com — your message came through and I'll get back to you as soon as I can, usually within 24-48 hours.`,
    ``,
    `For your records, here's what you sent:`,
    ``,
    `Topic: ${topicLabel}`,
    ``,
    `Message:`,
    p.message,
    ``,
    `— Sean`,
    '',
  ].join('\n');

  const html = `
<p>Hi ${escapeHtml(p.fname)},</p>
<p>Thanks for reaching out via seanreardon.com — your message came through and I'll get back to you as soon as I can, usually within 24-48 hours.</p>
<p>For your records, here's what you sent:</p>
<p>
  <strong>Topic:</strong> ${escapeHtml(topicLabel)}
</p>
<p><strong>Message:</strong></p>
<p style="white-space: pre-wrap;">${escapeHtml(p.message)}</p>
<p>— Sean</p>
`.trim();

  await resendSend(env, {
    from: `Sean Reardon <${env.CONTACT_FROM_EMAIL}>`,
    to: p.email,
    reply_to: env.CONTACT_DESTINATION_EMAIL,
    subject: `Got your message — Sean Reardon`,
    text,
    html,
  });
}

interface ResendPayload {
  from: string;
  to: string;
  reply_to: string;
  subject: string;
  text: string;
  html: string;
}

async function resendSend(env: Env, body: ResendPayload): Promise<void> {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errBody = await response.text();
    throw new Error(`Resend ${response.status}: ${errBody}`);
  }
}

function normalizeUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `http://${trimmed}`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function corsHeaders(origin: string): Record<string, string> {
  if (ALLOWED_ORIGINS.includes(origin)) {
    return {
      'Access-Control-Allow-Origin': origin,
      'Vary': 'Origin',
    };
  }
  return {};
}

function preflight(origin: string): Response {
  if (!ALLOWED_ORIGINS.includes(origin)) {
    return new Response(null, { status: 403 });
  }
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
      'Vary': 'Origin',
    },
  });
}

function json(body: unknown, status: number, origin: string): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders(origin),
    },
  });
}
