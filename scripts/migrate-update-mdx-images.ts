#!/usr/bin/env tsx
/**
 * Migration step 3 of 3 — populate `mainImg` / `otherImg` fields in
 * `src/content/work/*.mdx` from the Cloudflare Images URL mapping.
 *
 * Reads `tmp/legacy-image-cf-urls.json` (produced by `migrate-upload-cf-images.ts`),
 * then for each work MDX file:
 *   - Looks up `legacyMainImg` in the mapping → writes `mainImg: "<cf-url>"` in
 *     the frontmatter (insert if absent; replace if present).
 *   - Splits `legacyOtherImg` on commas → maps each filename through the JSON
 *     → joins the resulting URLs with commas → writes `otherImg: "<urls>"`.
 *
 * The `legacyMainImg` / `legacyOtherImg` fields stay in place as a paper
 * trail so the migration is reversible / auditable.
 *
 * Usage:
 *   npx tsx scripts/migrate-update-mdx-images.ts
 *
 * No env vars required — purely local file work. Idempotent: running twice
 * produces the same result; if `mainImg` is already populated, it gets
 * overwritten with whatever the current mapping says (so re-running after
 * a CF Images variant change picks up the new URL).
 */

import { readFile, readdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const MAPPING_FILE = 'tmp/legacy-image-cf-urls.json';
const WORK_DIR = 'src/content/work';

/**
 * Insert or replace a frontmatter field. The file's content is mutated; the
 * mutated string is returned. If the field already exists, its value is
 * replaced. If it doesn't, the field is inserted immediately ABOVE its
 * "legacy" counterpart (so `mainImg` appears right above `legacyMainImg` for
 * readable diffs).
 */
function setFrontmatterField(content: string, field: string, value: string, insertAbove: string): string {
  const fieldRegex = new RegExp(`^${field}:.*$`, 'm');
  const newLine = `${field}: "${value}"`;
  if (fieldRegex.test(content)) {
    return content.replace(fieldRegex, newLine);
  }
  const insertRegex = new RegExp(`^(${insertAbove}:.*)$`, 'm');
  return content.replace(insertRegex, `${newLine}\n$1`);
}

/** Extract a single frontmatter value (the part after `field:`, with surrounding quotes stripped). */
function getFrontmatterValue(content: string, field: string): string | null {
  const m = content.match(new RegExp(`^${field}:\\s*(.+)$`, 'm'));
  if (!m) return null;
  return m[1].trim().replace(/^["']|["']$/g, '');
}

async function main() {
  if (!existsSync(MAPPING_FILE)) {
    console.error(`Mapping file not found: ${MAPPING_FILE}`);
    console.error('Run scripts/migrate-upload-cf-images.ts first.');
    process.exit(1);
  }
  const mapping = JSON.parse(await readFile(MAPPING_FILE, 'utf8')) as Record<string, string>;
  console.log(`Loaded mapping with ${Object.keys(mapping).length} entries`);

  const files = (await readdir(WORK_DIR)).filter((f) => f.endsWith('.mdx'));
  let updated = 0;
  let unchanged = 0;

  for (const file of files) {
    const path = join(WORK_DIR, file);
    const original = await readFile(path, 'utf8');
    let content = original;

    // mainImg from legacyMainImg
    const legacyMain = getFrontmatterValue(content, 'legacyMainImg');
    if (legacyMain && mapping[legacyMain]) {
      content = setFrontmatterField(content, 'mainImg', mapping[legacyMain], 'legacyMainImg');
    }

    // otherImg from legacyOtherImg (comma-separated)
    const legacyOther = getFrontmatterValue(content, 'legacyOtherImg');
    if (legacyOther) {
      const filenames = legacyOther.split(',').map((s) => s.trim()).filter(Boolean);
      const urls = filenames.map((f) => mapping[f]).filter(Boolean);
      if (urls.length > 0) {
        content = setFrontmatterField(content, 'otherImg', urls.join(','), 'legacyOtherImg');
      }
    }

    if (content !== original) {
      await writeFile(path, content, 'utf8');
      console.log(`UPDATED ${file}`);
      updated++;
    } else {
      unchanged++;
    }
  }

  console.log('');
  console.log(`Done. Updated: ${updated}; Unchanged (no matching mapping or no legacy field): ${unchanged}.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
