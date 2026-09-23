// Publishes a code from the "Add a code" workflow or the /code command.
//   GAME=slayers-2 CODE=NEWCODE REWARD="30 Spins" EXPIRES=2026-10-01 node scripts/add-code.mjs
// GAME also accepts a Roblox link, so pasting the game's URL works too.
// STATUS=expired marks an existing code dead instead.
// Running it also stamps today's date as "last checked" for that game.
import fs from 'node:fs/promises';
import { GAMES_DIR, readJson, writeJson, sendDiscord, placeIdFromUrl } from './roblox.mjs';

const rawGame = (process.env.GAME || '').trim();
const code = (process.env.CODE || '').trim();
const reward = (process.env.REWARD || '').trim();
const expires = (process.env.EXPIRES || '').trim() || null;
const status = (process.env.STATUS || 'active').trim() === 'expired' ? 'expired' : 'active';

if (!rawGame || !code) {
  console.error('Need a game and a code.');
  process.exit(1);
}

const files = (await fs.readdir(GAMES_DIR)).filter((f) => f.endsWith('.json'));
const slugs = files.map((f) => f.replace(/\.json$/, ''));

// Work out which game was meant: a slug, a Roblox link, or the game's name.
async function findGame() {
  const wanted = rawGame.toLowerCase();
  const asSlug = wanted.replace(/\s+/g, '-');
  if (slugs.includes(asSlug)) return asSlug;

  const placeId = placeIdFromUrl(rawGame);
  if (placeId) {
    for (const slug of slugs) {
      const data = await readJson(`${GAMES_DIR}/${slug}.json`, null);
      if (data && placeIdFromUrl(data.robloxUrl) === placeId) return slug;
    }
  }

  for (const slug of slugs) {
    const data = await readJson(`${GAMES_DIR}/${slug}.json`, null);
    if (data && data.name.toLowerCase() === wanted) return slug;
  }
  return null;
}

const game = await findGame();
if (!game) {
  console.error(`No game matched "${rawGame}". Games on the site: ${slugs.join(', ')}`);
  process.exit(1);
}

const path = `${GAMES_DIR}/${game}.json`;
const data = await readJson(path, null);

data.codes ??= [];
const existing = data.codes.find((c) => c.code.toLowerCase() === code.toLowerCase());
if (existing) {
  existing.status = status;
  if (reward) existing.reward = reward;
  if (expires) existing.expires = expires;
  if (status === 'expired') existing.expires = existing.expires ?? null;
} else {
  const entry = { code, reward, expires, status };
  // Active codes go to the top of the list, expired ones to the bottom.
  if (status === 'active') data.codes.unshift(entry);
  else data.codes.push(entry);
}

data.lastChecked = new Date().toISOString().slice(0, 10);
await writeJson(path, data);

const active = data.codes.filter((c) => c.status === 'active').length;
console.log(`${status === 'active' ? 'Added' : 'Expired'} ${code} for ${data.name}. Active codes: ${active}`);
await sendDiscord(
  `${status === 'active' ? '✅ New code live' : '⌛ Code expired'}: **${data.name}** \`${code}\`` +
    `${reward ? ` — ${reward}` : ''}\nhttps://earlyspawn.com/codes/${game}/`,
  'codes'
);
