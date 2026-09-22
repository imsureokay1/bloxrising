// Publishes a code from the "Add a code" workflow, so you never edit JSON by hand.
//   GAME=slayers-2 CODE=NEWCODE REWARD="30 Spins" EXPIRES=2026-10-01 node scripts/add-code.mjs
// STATUS=expired marks an existing code dead instead.
// Running it also stamps today's date as "last checked" for that game.
import fs from 'node:fs/promises';
import { GAMES_DIR, readJson, writeJson, sendDiscord } from './roblox.mjs';

const game = (process.env.GAME || '').trim().toLowerCase().replace(/\s+/g, '-');
const code = (process.env.CODE || '').trim();
const reward = (process.env.REWARD || '').trim();
const expires = (process.env.EXPIRES || '').trim() || null;
const status = (process.env.STATUS || 'active').trim() === 'expired' ? 'expired' : 'active';

if (!game || !code) {
  console.error('Need a game and a code.');
  process.exit(1);
}

const path = `${GAMES_DIR}/${game}.json`;
const data = await readJson(path, null);
if (!data) {
  const have = (await fs.readdir(GAMES_DIR)).map((f) => f.replace(/\.json$/, '')).join(', ');
  console.error(`No game called "${game}". Games on the site: ${have}`);
  process.exit(1);
}

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
