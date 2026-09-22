// Runs on a schedule (GitHub Actions). For every game in src/data/games:
// - updates player counts and the "Rising this week" ranking on the site
// - retires codes once their expiry date passes
// - spots game updates and possible new codes in the game's Roblox description
// - pings your Discord (codes and updates go to their own channels)
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import {
  GAMES_DIR, STATE_FILE, placeIdFromUrl, universeIdForPlace, gameDetails,
  readJson, writeJson, formatPlayers, sendDiscord,
} from './roblox.mjs';

const DAY = 24 * 60 * 60 * 1000;
const RISING_SLOTS = 5;
const MIN_PLAYERS_FOR_RISING = 1000;

const IGNORE = new Set([
  'CODE', 'CODES', 'UPDATE', 'UPDATES', 'ROBLOX', 'DISCORD', 'GROUP', 'JOIN', 'LIKE', 'FREE',
  'NEW', 'REWARD', 'REWARDS', 'FAVORITE', 'FOLLOW', 'SPINS', 'THANKS', 'THANK', 'ENJOY', 'MORE',
  'LIKES', 'VISITS', 'REDEEM', 'ACTIVE', 'EXPIRED', 'TWITTER', 'YOUTUBE', 'SERVER', 'GAME',
]);

// Pulls likely codes from lines that mention "code". Always needs a human check.
function codeCandidates(description = '') {
  const found = new Set();
  for (const line of description.split(/\r?\n/)) {
    if (!/code/i.test(line)) continue;
    const text = line.includes(':') ? line.slice(line.indexOf(':') + 1) : line;
    for (const tok of text.match(/[A-Za-z0-9_!]{4,30}/g) ?? []) {
      const up = tok.toUpperCase();
      if (IGNORE.has(up.replace(/!/g, ''))) continue;
      const hasDigit = /\d/.test(tok) && /[A-Za-z]/.test(tok);
      const allCaps = tok.length >= 5 && tok === up && /[A-Z]/.test(tok);
      const mixed = /[a-z][A-Z]/.test(tok) && tok.length >= 6;
      if (hasDigit || allCaps || mixed || tok.includes('!')) found.add(tok);
    }
  }
  return [...found];
}

function growthPct(history, now, playing) {
  const old = history.filter((h) => now - h.t >= 20 * 60 * 60 * 1000);
  if (!old.length) return null;
  const ref = old.reduce((a, b) => (Math.abs(now - DAY - b.t) < Math.abs(now - DAY - a.t) ? b : a));
  if (!ref.p) return null;
  return ((playing - ref.p) / ref.p) * 100;
}

const state = await readJson(STATE_FILE, {});
const files = (await fs.readdir(GAMES_DIR)).filter((f) => f.endsWith('.json'));
const games = [];

for (const file of files) {
  const id = file.replace(/\.json$/, '');
  const path = `${GAMES_DIR}/${file}`;
  const data = await readJson(path, null);
  if (!data) continue;
  const placeId = placeIdFromUrl(data.robloxUrl);
  if (!placeId) {
    console.warn(`${id}: no place id in robloxUrl`);
    continue;
  }
  state[id] ??= {};
  if (!state[id].universeId || state[id].placeId !== placeId) {
    state[id].universeId = await universeIdForPlace(placeId);
    state[id].placeId = placeId;
  }
  games.push({ id, path, data, original: JSON.stringify(data) });
}

const details = await gameDetails(games.map((g) => state[g.id].universeId).filter(Boolean));
const now = Date.now();
const today = new Date().toISOString().slice(0, 10);
const tomorrow = new Date(now + DAY).toISOString().slice(0, 10);
const codeAlerts = [];
const updateAlerts = [];

for (const g of games) {
  const s = state[g.id];
  const info = details[s.universeId];
  if (!info) continue;
  const name = g.data.name;
  const url = `https://earlyspawn.com/games/${g.id}/`;

  // Player history, kept for 8 days.
  s.history = [...(s.history ?? []), { t: now, p: info.playing }].filter((h) => now - h.t <= 8 * DAY);
  g.playing = info.playing;
  g.growth = growthPct(s.history, now, info.playing);
  g.data.players = formatPlayers(info.playing);

  // Game update detection.
  if (s.updated && info.updated && s.updated !== info.updated) {
    updateAlerts.push(`🔄 **${name}** just updated. New codes often come with updates, so check the in-game code list. ${url}`);
  }
  s.updated = info.updated;

  // Retire codes whose expiry date has passed, and warn the day before.
  for (const c of g.data.codes ?? []) {
    if (c.status !== 'active' || !c.expires) continue;
    if (c.expires < today) {
      c.status = 'expired';
      codeAlerts.push(`⌛ **${name}**: \`${c.code}\` expired, so it moved to the expired list. ${url}`);
    } else if (c.expires === today || c.expires === tomorrow) {
      codeAlerts.push(`⏳ **${name}**: \`${c.code}\` expires ${c.expires}. Check in-game for a replacement code.`);
    }
  }

  // Nudge to re-check games whose codes haven't been looked at in a while.
  const staleDays = g.data.lastChecked
    ? Math.floor((now - Date.parse(`${g.data.lastChecked}T12:00:00Z`)) / DAY)
    : null;
  if (staleDays !== null && staleDays >= 7 && staleDays % 7 === 0 && s.staleNudged !== today) {
    s.staleNudged = today;
    codeAlerts.push(`🕰️ **${name}** codes haven't been checked for ${staleDays} days. ${url}`);
  }

  // Description changes -> possible codes.
  const hash = crypto.createHash('sha1').update(info.description ?? '').digest('hex');
  if (s.descHash && s.descHash !== hash) {
    const known = new Set((g.data.codes ?? []).map((c) => c.code.toUpperCase()));
    const fresh = codeCandidates(info.description).filter((c) => !known.has(c.toUpperCase()));
    if (fresh.length) {
      codeAlerts.push(
        `🎁 **${name}**: possible new codes in the game description: ${fresh.map((c) => `\`${c}\``).join(', ')}\n` +
          `Check them in-game, then publish them with the "Add a code" action.`
      );
    } else {
      updateAlerts.push(`📝 **${name}** changed its Roblox description. Worth a quick look. ${g.data.robloxUrl}`);
    }
  }
  s.descHash = hash;
}

// Rising ranking: fastest 24h player growth first; games without enough history rank by players.
const ranked = games
  .filter((g) => typeof g.playing === 'number' && g.playing >= MIN_PLAYERS_FOR_RISING)
  .sort((a, b) => {
    if (a.growth != null && b.growth != null) return b.growth - a.growth;
    if (a.growth != null) return -1;
    if (b.growth != null) return 1;
    return b.playing - a.playing;
  });
const previousTop = games.filter((g) => g.data.rising === 1).map((g) => g.id)[0];
for (const g of games) g.data.rising = null;
ranked.slice(0, RISING_SLOTS).forEach((g, i) => (g.data.rising = i + 1));
const newTop = ranked[0]?.id;
if (newTop && previousTop && newTop !== previousTop) {
  const top = ranked[0];
  const pct = top.growth != null ? ` (${top.growth > 0 ? '+' : ''}${top.growth.toFixed(0)}% in 24h)` : '';
  updateAlerts.push(`📈 New #1 rising game: **${top.data.name}**${pct}.`);
}

// Save only files that actually changed.
let changed = 0;
for (const g of games) {
  if (JSON.stringify(g.data) !== g.original) {
    await writeJson(g.path, g.data);
    changed++;
  }
}
await writeJson(STATE_FILE, state);

console.log(
  `Tracked ${games.length} games, updated ${changed} files, ` +
    `${codeAlerts.length} code alerts, ${updateAlerts.length} update alerts.`
);
if (codeAlerts.length) await sendDiscord(codeAlerts.join('\n\n'), 'codes');
if (updateAlerts.length) await sendDiscord(updateAlerts.join('\n\n'), 'updates');
