import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import top from './src/data/top-games.json' with { type: 'json' };

// Games that appear in the top 10 but don't have a written page yet. Their
// stub pages are noindexed, so they stay out of the sitemap too.
const stubs = new Set(
  (top.games ?? [])
    .filter((g) => !g.covered && g.slug)
    .map((g) => `https://earlyspawn.com/games/${g.slug}/`)
);

export default defineConfig({
  site: 'https://earlyspawn.com',
  integrations: [
    sitemap({
      filter: (page) => !stubs.has(page),
    }),
  ],
});
