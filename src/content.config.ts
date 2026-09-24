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
    // Only fill this in when you KNOW who made the game (e.g. from the game's own
    // credits or official channels). Leave '' if unsure; the site then shows nothing.
    developer: z.string().default(''),
    // The Roblox group or user that owns the game, straight from Roblox's API.
    // Kept for reference only. It's often a marketing name, so it is never displayed.
    robloxOwner: z.string().optional(),
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
    // The date a person last reviewed this game's code list (set by /code).
    // It means "the list was reviewed", NOT "every code was redeemed".
    lastChecked: z.string().nullable().default(null),
    // Position in the "rising" list (1 = top). Based on 24-hour player growth. null = not listed.
    rising: z.number().nullable().default(null),
    players: z.string().nullable().default(null),
    codes: z.array(
      z.object({
        code: z.string(),
        reward: z.string().default(''),
        // Date the code stops working, if the game shows it, e.g. "2026-09-25".
        expires: z.string().nullable().default(null),
        status: z.enum(['active', 'expired']),
        // Date WE redeemed this exact code in Roblox ourselves. Only set this after
        // actually redeeming it. null = not tested, and the page says so.
        tested: z.string().nullable().default(null),
        // Where the code came from, e.g. "In-game code list", "Developer Discord",
        // "Blox Fruits Wiki". Shown on the page next to untested codes.
        source: z.string().default(''),
      })
    ).default([]),
    // Shown instead of the code list when a game has no working codes (e.g. no code box in-game yet).
    codesNote: z.string().default(''),
    redeemSteps: z.array(z.string()).default([]),
    // Screenshot of where to redeem. Put the file in public/images/<game>/ and write its path here.
    redeemImage: z.object({ src: z.string(), alt: z.string() }).nullable().default(null),
    troubleshooting: z.array(z.object({ q: z.string(), a: z.string() })).default([]),
    // Questions players actually ask about this game. Shown on the codes page and marked up as an FAQ.
    faq: z.array(z.object({ q: z.string(), a: z.string() })).default([]),
  }),
});

// Markdown guides in src/content/guides. File name -> earlyspawn.com/guides/<n>
const guides = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/guides' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    game: z.string(), // must match a game file name, e.g. "slayers-2"
    kind: z.enum(['guide', 'spotlight', 'update', 'tier-list']),
    // First published. Only set when the real date is known; leave it out otherwise.
    published: z.coerce.date().optional(),
    updated: z.coerce.date(),
    // Thumbnail for guide listings. Leave it out and the game's icon is used instead.
    image: z.string().nullable().default(null),
    // true only if we played through what the guide describes ourselves.
    tested: z.boolean().default(false),
    // Where the information came from. Shown in a note at the top of the guide.
    sources: z.array(z.object({ name: z.string(), url: z.string().url().optional() })).default([]),
  }),
});

export const collections = { games, guides };
