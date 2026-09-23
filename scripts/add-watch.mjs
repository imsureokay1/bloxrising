// Adds a Discord channel or YouTube channel to the watch list (data/watch.json),
// so /watch in Discord can extend it without touching secrets.
// For YouTube you can pass a channel ID (UC...), a @handle, or any channel link.
import { readJson, writeJson, sendDiscord, GAMES_DIR } from './roblox.mjs';

const WATCH_FILE = 'data/watch.json';
const source = (process.env.SOURCE || 'discord').trim().toLowerCase();
let id = (process.env.ID || '').trim();
const game = (process.env.GAME || '').trim().toLowerCase();

if (!id || !['discord', 'youtube'].includes(source)) {
  console.error('Need a source of discord or youtube, and an id.');
  process.exit(1);
}

// Turn a YouTube link or @handle into the channel ID the RSS feed needs.
async function resolveYouTube(value) {
  if (/^UC[\w-]{22}$/.test(value)) return value;
  const direct = value.match(/channel\/(UC[\w-]{22})/);
  if (direct) return direct[1];

  const url = value.startsWith('http')
    ? value.replace(/\/+$/, '')
    : `https://www.youtube.com/${value.startsWith('@') ? value : '@' + value}`;
  const res = await fetch(url, { headers: { 'accept-language': 'en' } });
  if (!res.ok) throw new Error(`Could not open ${url} (${res.status})`);
  const html = await res.text();
  const found =
    html.match(/"channelId":"(UC[\w-]{22})"/) ||
    html.match(/channel\/(UC[\w-]{22})/) ||
    html.match(/"externalId":"(UC[\w-]{22})"/);
  if (!found) throw new Error(`No channel ID found on ${url}`);
  return found[1];
}

if (source === 'youtube') {
  try {
    const resolved = await resolveYouTube(id);
    if (resolved !== id) console.log(`Resolved ${id} to ${resolved}`);
    id = resolved;
  } catch (err) {
    console.error(err.message);
    await sendDiscord(`⚠️ Couldn't work out the YouTube channel ID for \`${id}\`.`, 'updates');
    process.exit(1);
  }
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
