import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://places-weve-been-site.workers.dev',
  build: { inlineStylesheets: 'always' },
});
