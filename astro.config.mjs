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
  // In production, /api/* never reaches the Astro output at all — Cloudflare's
  // edge routes it to the Worker before the origin sees it (see wrangler.toml).
  // The dev server has no such edge, so a page fetching /api/exam-save would get
  // a 404 from Astro and the save UI could not be exercised locally at all.
  // Proxying to `wrangler dev` reproduces the production shape: same-origin
  // relative URLs in the component, the real Worker code answering them.
  //
  //   terminal 1: npm run worker:dev   (wrangler, port 8787, local R2)
  //   terminal 2: npm run dev
  //
  // With no Worker running the proxy just fails the fetch, which is the same
  // thing the UI already handles as "the save could not be completed".
  vite: {
    server: {
      proxy: {
        '/api': {
          target: 'http://127.0.0.1:8787',
          changeOrigin: false,
        },
      },
    },
  },
});
