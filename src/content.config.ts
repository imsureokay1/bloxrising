import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

// One JSON file per game in src/data/games. The file name becomes the page URL:
// slayers-2.json -> earlyspawn.com/codes/slayers-2
const games = defineCollection({
  loader: glob({ pattern: '*.json', base: './src/data/games' }),
  schema: z.object({
    name: z.string(),
    // Another name people search for, e.g. "Project Slayers 2". Optional.
    altName: z.string().default(''),
    developer: z.string().default(''),
    robloxUrl: z.string().url(),
    group: z.string().optional(),
    summary: z.string().default(''),
    // "About the game" section on the game's hub page. Separate paragraphs with a blank line (\n\n).
    about: z.string().default(''),
    genre: z.string().default(''),
    // Square game icon and wide cover image, e.g. "/images/slayers-2/icon.webp". null = letter tile / no banner.
    icon: z.string().nullable().default(null),
    cover: z.string().nullable().default(null),
    released: z.string().nullable().default(null), // e.g. "2026-09-18"
    quickFacts: z.array(z.object({ label: z.string(), value: z.string() })).default([]),
    // When you last checked the codes in-game, e.g. "2026-09-21". null = not checked yet.
    lastChecked: z.string().nullable().default(null),
    // Position in "Rising this week" (1 = top). null = not in the list.
    rising: z.number().nullable().default(null),
    // Shown in "Rising this week", e.g. "150K playing". null = hidden.
    players: z.string().nullable().default(null),
    codes: z.array(
      z.object({
        code: z.string(),
        reward: z.string().default(''),
        // Date the code stops working, if the game shows it, e.g. "2026-09-25".
        expires: z.string().nullable().default(null),
        status: z.enum(['active', 'expired']),
      })
    ).default([]),
    redeemSteps: z.array(z.string()).default([]),
    // Screenshot of where to redeem. Put the file in public/images/<game>/ and write its path here.
    redeemImage: z.object({ src: z.string(), alt: z.string() }).nullable().default(null),
    troubleshooting: z.array(z.object({ q: z.string(), a: z.string() })).default([]),
  }),
});

// Markdown guides in src/content/guides. File name -> earlyspawn.com/guides/<name>
const guides = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/guides' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    game: z.string(), // must match a game file name, e.g. "slayers-2"
    kind: z.enum(['guide', 'spotlight', 'update', 'tier-list']),
    updated: z.coerce.date(),
  }),
});

export const collections = { games, guides };
