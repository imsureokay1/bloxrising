// Small helpers for Roblox's public web APIs (no login needed).
import fs from 'node:fs/promises';

export const GAMES_DIR = 'src/data/games';
export const STATE_FILE = 'data/tracker-state.json';

async function getJson(url, tries = 3) {
  for (let i = 1; i <= tries; i++) {
    try {
      const res = await fetch(url, { headers: { accept: 'application/json' } });
      if (res.ok) return await res.json();
      if (res.status !== 429 && res.status < 500) throw new Error(`${res.status} for ${url}`);
    } catch (err) {
      if (i === tries) throw err;
    }
    await new Promise((r) => setTimeout(r, 1500 * i));
  }
  throw new Error(`Failed: ${url}`);
}

export function placeIdFromUrl(url) {
  const m = String(url).match(/games\/(\d+)/);
  return m ? m[1] : null;
}

export async function universeIdForPlace(placeId) {
  const data = await getJson(`https://apis.roblox.com/universes/v1/places/${placeId}/universe`);
  return data.universeId ? String(data.universeId) : null;
}

// Details for up to 50 games at once: name, playing, visits, updated, description, creator.
export async function gameDetails(universeIds) {
  const out = {};
  for (let i = 0; i < universeIds.length; i += 50) {
    const batch = universeIds.slice(i, i + 50);
    const data = await getJson(`https://games.roblox.com/v1/games?universeIds=${batch.join(',')}`);
    for (const g of data.data ?? []) out[String(g.id)] = g;
  }
  return out;
}

export async function iconUrl(universeId) {
  const data = await getJson(
    `https://thumbnails.roblox.com/v1/games/icons?universeIds=${universeId}&size=256x256&format=Png&isCircular=false`
  );
  const item = (data.data ?? [])[0];
  return item && item.state === 'Completed' ? item.imageUrl : null;
}

export async function downloadTo(url, path) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed ${res.status}`);
  await fs.mkdir(path.split('/').slice(0, -1).join('/'), { recursive: true });
  await fs.writeFile(path, Buffer.from(await res.arrayBuffer()));
}

export async function readJson(path, fallback) {
  try {
    return JSON.parse(await fs.readFile(path, 'utf8'));
  } catch {
    return fallback;
  }
}

export async function writeJson(path, value) {
  await fs.mkdir(path.split('/').slice(0, -1).join('/'), { recursive: true });
  await fs.writeFile(path, JSON.stringify(value, null, 2) + '\n');
}

export function slugify(name) {
  return String(name)
    .toLowerCase()
    .replace(/\[[^\]]*\]|\([^)]*\)/g, ' ') // drop [UPDATE], (NEW) style tags
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

// Removes emoji and bracket tags like "[UPDATE 3]" from a Roblox game title.
export function cleanName(name) {
  return String(name)
    .replace(/\[[^\]]*\]|\([^)]*\)/g, ' ')
    .replace(/[^\p{L}\p{N}\s'&:!.-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function formatPlayers(n) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M playing`;
  if (n >= 10_000) return `${Math.round(n / 1000)}K playing`;
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}K playing`;
  return `${n} playing`;
}

export async function sendDiscord(content, kind = 'general') {
  // Route by kind so codes and updates can land in different channels.
  // Set DISCORD_CODES_WEBHOOK_URL and DISCORD_UPDATES_WEBHOOK_URL to split them;
  // anything missing falls back to DISCORD_WEBHOOK_URL.
  const hook =
    (kind === 'codes' && process.env.DISCORD_CODES_WEBHOOK_URL) ||
    (kind === 'updates' && process.env.DISCORD_UPDATES_WEBHOOK_URL) ||
    process.env.DISCORD_WEBHOOK_URL;
  if (!hook) {
    console.log(`[discord skipped: ${kind}]`, content);
    return;
  }
  // Discord messages max out at 2000 characters.
  for (let i = 0; i < content.length; i += 1900) {
    await fetch(hook, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ content: content.slice(i, i + 1900), allowed_mentions: { parse: [] } }),
    });
  }
}
