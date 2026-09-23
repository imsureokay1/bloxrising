// Adds a Discord channel or YouTube channel to the watch list (data/watch.json),
// so /watch in Discord can extend it without touching secrets.
import { readJson, writeJson, sendDiscord, GAMES_DIR } from './roblox.mjs';

const WATCH_FILE = 'data/watch.json';
const source = (process.env.SOURCE || 'discord').trim().toLowerCase();
const id = (process.env.ID || '').trim();
const game = (process.env.GAME || '').trim().toLowerCase();

if (!id || !['discord', 'youtube'].includes(source)) {
  console.error('Need a source of discord or youtube, and an id.');
  process.exit(1);
}

const watch = await readJson(WATCH_FILE, { discord: [], youtube: [] });
watch[source] ??= [];
const existing = watch[source].find((w) => w.id === id);
if (existing) {
  existing.game = game || existing.game;
} else {
  watch[source].push({ id, game });
}
await writeJson(WATCH_FILE, watch);

const data = game ? await readJson(`${GAMES_DIR}/${game}.json`, null) : null;
console.log(`Watching ${source} ${id}${game ? ` for ${game}` : ''}.`);
await sendDiscord(
  `👀 Now watching a ${source} channel${data ? ` for **${data.name}**` : ''}. New posts there get checked for codes.`,
  'updates'
);
