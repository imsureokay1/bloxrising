// Builds the "Top 10 by players" list for the homepage.
// Pulls candidate games from Roblox's own discover sorts, checks live player
// counts, and writes the top ten to src/data/top-games.json.
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import { GAMES_DIR, gameDetails, placeIdFromUrl, readJson, writeJson, slugify, cleanName, formatPlayers } from './roblox.mjs';

const OUT = 'src/data/top-games.json';
const TAKE = 10;

// Walks any JSON shape and collects every universeId it finds.
function universeIdsIn(value, found = new Set()) {
  if (!value || typeof value !== 'object') return found;
  if (Array.isArray(value)) {
    for (const v of value) universeIdsIn(v, found);
    return found;
  }
  for (const [k, v] of Object.entries(value)) {
    if (k === 'universeId' && (typeof v === 'number' || typeof v === 'string')) found.add(String(v));
    else universeIdsIn(v, found);
  }
  return found;
}

async function discoverIds() {
  const sessionId = crypto.randomUUID();
  const res = await fetch(
    `https://apis.roblox.com/explore-api/v1/get-sorts?sessionId=${sessionId}`,
    { headers: { accept: 'application/json' } }
  );
  if (!res.ok) throw new Error(`get-sorts ${res.status}`);
  return [...universeIdsIn(await res.json())];
}

async function iconsFor(universeIds) {
  const out = {};
  for (let i = 0; i < universeIds.length; i += 50) {
    const batch = universeIds.slice(i, i + 50);
    const res = await fetch(
      `https://thumbnails.roblox.com/v1/games/icons?universeIds=${batch.join(',')}&size=256x256&format=Png&isCircular=false`
    );
    if (!res.ok) continue;
    for (const item of (await res.json()).data ?? []) {
      if (item.state === 'Completed') out[String(item.targetId)] = item.imageUrl;
    }
  }
  return out;
}

// Games we already cover, keyed by their Roblox place id.
async function coveredGames() {
  const byPlace = new Map();
  for (const file of (await fs.readdir(GAMES_DIR)).filter((f) => f.endsWith('.json'))) {
    const slug = file.replace(/\.json$/, '');
    const data = await readJson(`${GAMES_DIR}/${file}`, null);
    const placeId = data && placeIdFromUrl(data.robloxUrl);
    if (placeId) byPlace.set(placeId, { slug, name: data.name });
  }
  return byPlace;
}

let ids = [];
try {
  ids = await discoverIds();
} catch (err) {
  console.warn(`Discover failed (${err.message}); falling back to tracked games only.`);
}

// Always include the games we cover, so they can appear in the list too.
const covered = await coveredGames();
const state = await readJson('data/tracker-state.json', {});
for (const entry of Object.values(state)) {
  if (entry?.universeId) ids.push(String(entry.universeId));
}
ids = [...new Set(ids)].slice(0, 200);

if (ids.length === 0) {
  console.log('No games to rank.');
  process.exit(0);
}

const details = await gameDetails(ids);
const ranked = Object.values(details)
  .filter((g) => typeof g.playing === 'number')
  .sort((a, b) => b.playing - a.playing)
  .slice(0, TAKE);

const icons = await iconsFor(ranked.map((g) => String(g.id)));

const games = ranked.map((g, i) => {
  const placeId = String(g.rootPlaceId ?? '');
  const known = covered.get(placeId);
  const name = cleanName(g.name) || g.name;
  return {
    rank: i + 1,
    name: known?.name ?? name,
    slug: known?.slug ?? slugify(name),
    covered: Boolean(known),
    developer: g.creator?.name ?? '',
    placeId,
    universeId: String(g.id),
    playing: g.playing,
    players: formatPlayers(g.playing),
    icon: icons[String(g.id)] ?? null,
  };
});

await writeJson(OUT, { updated: new Date().toISOString().slice(0, 10), games });
console.log(`Top ${games.length}: ${games.map((g) => `${g.name} (${g.players})`).join(', ')}`);
