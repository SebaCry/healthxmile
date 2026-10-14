import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  site: 'https://healthyxmile.com',
  integrations: [sitemap()],
  // Pages load behind a curtain wipe; prefetching on hover makes the reveal instant.
  prefetch: { prefetchAll: true },
});
