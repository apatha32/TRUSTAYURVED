// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// Static build. URLs and slugs mirror the live WordPress site exactly.
export default defineConfig({
  site: 'https://trustayurved.com',
  trailingSlash: 'ignore',
  build: { format: 'directory', inlineStylesheets: 'always' },
  redirects: {
    // Live site 301s /shop/ to the homepage — preserved.
    '/shop': '/',
  },
  integrations: [
    sitemap({ filter: (page) => !page.includes('/style-guide') && !page.includes('/shop') }),
  ],
  image: { responsiveStyles: false },
  prefetch: { prefetchAll: false, defaultStrategy: 'hover' },
});
