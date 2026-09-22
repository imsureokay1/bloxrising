// Adds a new game from its Roblox link:
//   node scripts/add-game.mjs https://www.roblox.com/games/123456789/Some-Game
// Creates src/data/games/<name>.json and downloads the game icon.
import fs from 'node:fs/promises';
import {
  GAMES_DIR, STATE_FILE, placeIdFromUrl, universeIdForPlace, gameDetails, iconUrl,
  downloadTo, readJson, writeJson, slugify, cleanName, formatPlayers, sendDiscord,
} from './roblox.mjs';

const link = (process.argv[2] || process.env.GAME_URL || '').trim();
const placeId = placeIdFromUrl(link);
if (!placeId) {
  console.error('Give a Roblox game link, like https://www.roblox.com/games/123456789/Game-Name');
  process.exit(1);
}

const universeId = await universeIdForPlace(placeId);
const info = (await gameDetails([universeId]))[universeId];
if (!info) throw new Error('Roblox did not return this game.');

const name = cleanName(info.name) || info.name;
const id = slugify(name) || `game-${placeId}`;
const path = `${GAMES_DIR}/${id}.json`;

try {
  await fs.access(path);
  console.log(`${path} already exists. Nothing to do.`);
  process.exit(0);
} catch {}

let icon = null;
try {
  const img = await iconUrl(universeId);
  if (img) {
    await downloadTo(img, `public/images/${id}/icon.png`);
    icon = `/images/${id}/icon.png`;
  }
} catch (err) {
  console.warn('Icon download failed:', err.message);
}

const game = {
  name,
  altName: '',
  developer: info.creator?.name ?? '',
  robloxUrl: `https://www.roblox.com/games/${placeId}`,
  summary: `Codes, guides, and game info for ${name} on Roblox.`,
  about: '',
  genre: '',
  icon,
  cover: null,
  released: null,
  quickFacts: [],
  lastChecked: null,
  rising: null,
  players: formatPlayers(info.playing ?? 0),
  codes: [],
  redeemSteps: [],
  redeemImage: null,
  troubleshooting: [],
};
await writeJson(path, game);

const state = await readJson(STATE_FILE, {});
state[id] = { placeId, universeId, updated: info.updated, history: [{ t: Date.now(), p: info.playing ?? 0 }] };
await writeJson(STATE_FILE, state);

console.log(`Added ${name} -> ${path}`);
await sendDiscord(
  `➕ Added **${name}** (${formatPlayers(info.playing ?? 0)}). Page: https://earlyspawn.com/games/${id}/\n` +
    `Next: check its codes in-game, and send Claude a guide transcript to fill in the About section and a guide.`
);
