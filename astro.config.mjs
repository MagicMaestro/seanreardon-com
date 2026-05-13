import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  site: 'https://seanreardon.com',
  output: 'static',
  // Permissive: both /path and /path/ resolve. In dev (Astro server) both are accepted directly;
  // in production (Apache static), build.format: 'directory' outputs /path/index.html as the
  // canonical file, and Apache's default DirectorySlash On redirects /path → /path/ automatically.
  // Switched from 'always' on 2026-05-13 after a missing-trailing-slash 404 in dev (inter-post
  // link from two-pivots-on-analytics → compliant-with-laws). See process log 2026-05-13 entry.
  trailingSlash: 'ignore',
  build: {
    format: 'directory',
    inlineStylesheets: 'auto',
  },
  integrations: [
    react(),
    mdx(),
    sitemap(),
  ],
});
