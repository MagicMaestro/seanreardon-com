#!/usr/bin/env tsx
/**
 * Migration step 2 of 3 — upload local legacy project images to Cloudflare Images.
 *
 * Reads images from `tmp/legacy-images/` (populated by `migrate-fetch-images.sh`),
 * uploads each via the Cloudflare Images API, and writes a JSON mapping of
 * `{ legacy-filename: cf-delivery-url }` to `tmp/legacy-image-cf-urls.json`
 * for `migrate-update-mdx-images.ts` to consume.
 *
 * Usage:
 *   CF_API_TOKEN=<your-token> CF_ACCOUNT_ID=<your-account-id> \
 *     npx tsx scripts/migrate-upload-cf-images.ts
 *
 * Required env vars:
 *   - CF_API_TOKEN — Cloudflare API token with the `Images:Edit` permission.
 *     Per `feedback-secret-hygiene.md`, this is a real secret — never commit.
 *   - CF_ACCOUNT_ID — Cloudflare Account ID. Per `feedback-secret-hygiene.md`,
 *     this is an operational detail (not a secret), but kept in env for
 *     flexibility across accounts.
 *
 * Idempotency: subsequent runs skip files already present in the existing
 * mapping JSON. Delete `tmp/legacy-image-cf-urls.json` to force re-upload.
 *
 * Per `feedback-paid-services.md`: Cloudflare Images is a paid service Sean
 * already pays for via another project (Images Basic plan; existing-capacity
 * reuse — no new commitment).
 */

import { readFile, readdir, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const TOKEN = process.env.CF_API_TOKEN;
const ACCOUNT_ID = process.env.CF_ACCOUNT_ID;

if (!TOKEN || !ACCOUNT_ID) {
  console.error('Missing CF_API_TOKEN or CF_ACCOUNT_ID env var.');
  console.error('');
  console.error('Usage:');
  console.error('  CF_API_TOKEN=<token> CF_ACCOUNT_ID=<account-id> \\');
  console.error('    npx tsx scripts/migrate-upload-cf-images.ts');
  console.error('');
  console.error('Token requires the Images:Edit permission on the Cloudflare account');
  console.error('that hosts the Images Basic subscription.');
  process.exit(1);
}

const LOCAL_DIR = 'tmp/legacy-images';
const OUTPUT_FILE = 'tmp/legacy-image-cf-urls.json';
const API_URL = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/images/v1`;

/**
 * Preferred delivery variant for the uploaded images. CF Images returns
 * URLs in the shape `https://imagedelivery.net/<account-hash>/<image-id>/<variant>`.
 * The `public` variant is the default delivery variant on most CF Images
 * accounts; if Sean's account uses a different default, edit this.
 */
const PREFERRED_VARIANT = 'public';

interface CFImagesResponse {
  success: boolean;
  errors: Array<{ code: number; message: string }>;
  messages: unknown[];
  result?: {
    id: string;
    filename: string;
    uploaded: string;
    requireSignedURLs: boolean;
    variants: string[];
  };
}

async function uploadOne(filename: string, filepath: string): Promise<string> {
  const data = await readFile(filepath);
  const blob = new Blob([data]);
  const fd = new FormData();
  fd.append('file', blob, filename);

  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}` },
    body: fd,
  });

  const json = (await res.json()) as CFImagesResponse;
  if (!json.success || !json.result) {
    const errText = JSON.stringify(json.errors ?? json);
    throw new Error(`Upload failed (HTTP ${res.status}): ${errText}`);
  }
  // Pick the preferred variant URL; fall back to the first variant if not present
  const preferred = json.result.variants.find((v) => v.endsWith(`/${PREFERRED_VARIANT}`));
  return preferred ?? json.result.variants[0];
}

async function main() {
  if (!existsSync(LOCAL_DIR)) {
    console.error(`No local image directory at ${LOCAL_DIR}/`);
    console.error('Run scripts/migrate-fetch-images.sh first.');
    process.exit(1);
  }
  await mkdir('tmp', { recursive: true });

  const allFiles = await readdir(LOCAL_DIR);
  const imageFiles = allFiles.filter((f) => /\.(jpg|jpeg|png|webp|gif)$/i.test(f));
  console.log(`Found ${imageFiles.length} image files in ${LOCAL_DIR}/`);

  // Load existing mapping (idempotency)
  let mapping: Record<string, string> = {};
  if (existsSync(OUTPUT_FILE)) {
    try {
      mapping = JSON.parse(await readFile(OUTPUT_FILE, 'utf8'));
      console.log(`Existing mapping has ${Object.keys(mapping).length} entries — skipping those`);
    } catch {
      console.warn(`Existing ${OUTPUT_FILE} unreadable; starting fresh`);
    }
  }

  let uploaded = 0;
  let skipped = 0;
  let failed = 0;

  for (const filename of imageFiles) {
    if (mapping[filename]) {
      skipped++;
      continue;
    }
    process.stdout.write(`UPLOAD ${filename}... `);
    try {
      const url = await uploadOne(filename, join(LOCAL_DIR, filename));
      mapping[filename] = url;
      uploaded++;
      console.log(`OK → ${url}`);
      // Write mapping after each successful upload — partial-run safety.
      await writeFile(OUTPUT_FILE, JSON.stringify(mapping, null, 2) + '\n', 'utf8');
    } catch (err) {
      failed++;
      console.log(`FAILED — ${err instanceof Error ? err.message : err}`);
    }
  }

  console.log('');
  console.log(`Done. Uploaded: ${uploaded}; Skipped (already in mapping): ${skipped}; Failed: ${failed}.`);
  console.log(`Mapping at: ${OUTPUT_FILE}`);
  if (failed === 0) {
    console.log('Next: npx tsx scripts/migrate-update-mdx-images.ts');
  } else {
    console.log('Resolve the failures before running migrate-update-mdx-images.ts.');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
