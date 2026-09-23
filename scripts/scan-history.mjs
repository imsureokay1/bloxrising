// One-off scan of a Discord channel's past messages for codes you may have missed.
//   CHANNEL=123456789 GAME=slayers-2 LIMIT=300 node scripts/scan-history.mjs
// Reads backwards through the channel and reports every code-looking word it finds.
import { GAMES_DIR, readJson, sendDiscord } from './roblox.mjs';

const token = process.env.DISCORD_BOT_TOKEN;
const channel = (process.env.CHANNEL || '').trim();
const game = (process.env.GAME || '').trim().toLowerCase();
const limit = Math.min(Number(process.env.LIMIT || 300), 1000);

if (!token || !channel) {
  console.error('Need DISCORD_BOT_TOKEN and CHANNEL.');
  process.exit(1);
}

const IGNORE = new Set([
  'CODE', 'CODES', 'UPDATE', 'UPDATES', 'UPDATED', 'ROBLOX', 'DISCORD', 'GROUP', 'JOIN', 'LIKE',
  'LIKES', 'FREE', 'NEW', 'REWARD', 'REWARDS', 'REDEEM', 'ACTIVE', 'EXPIRED', 'EVERYONE', 'HERE',
  'ANNOUNCEMENT', 'ANNOUNCEMENTS', 'PLAY', 'PLAYING', 'THANKS', 'THANK', 'SERVER', 'SERVERS',
  'GAME', 'GAMES', 'PATCH', 'NOTES', 'SOON', 'HTTPS', 'HTTP', 'ROBUX', 'GIVEAWAY', 'GIVEAWAYS',
  'RELEASE', 'RELEASED', 'EVENT', 'EVENTS', 'SHUTDOWN', 'MAINTENANCE', 'FIXED', 'FIXES', 'BUGS',
  'BUFFED', 'NERFED', 'ADDED', 'REMOVED', 'COMING', 'VOTE', 'VOTED', 'ROLE', 'ROLES', 'BOOST',
  'CHANGELOG', 'VERSION', 'BETA', 'ALPHA', 'PART', 'SEASON', 'WEEK', 'TODAY', 'TOMORROW',
]);

function clean(text) {
  return text
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/<a?:\w+:\d+>/g, ' ')
    .replace(/<[@#&!][^>]*>/g, ' ')
    .replace(/[*_~`>|]/g, ' ');
}

function looksLikeCode(tok) {
  const up = tok.toUpperCase();
  if (IGNORE.has(up.replace(/!/g, ''))) return false;
  if (tok.length < 4 || tok.length > 30 || !/[A-Za-z]/.test(tok)) return false;
  const allCaps = tok === up && tok.length >= 5;
  const hasDigit = /\d/.test(tok);
  const camel = /[a-z][A-Z]/.test(tok) && tok.length >= 6;
  if (allCaps && hasDigit) return true;
  if (camel) return true;
  if ((tok.includes('!') || tok.includes('_')) && tok.length >= 6 && tok === up) return true;
  return allCaps && !tok.endsWith('!');
}

function codesIn(raw = '') {
  const text = clean(raw);
  const mentions = /\b(code|codes|redeem|use|using|enter|type)\b/i.test(text);
  const found = new Set();
  for (const tok of text.match(/[A-Za-z0-9_!]{4,30}/g) ?? []) {
    if (!looksLikeCode(tok)) continue;
    const strong = /\d/.test(tok) && tok === tok.toUpperCase();
    if (mentions || strong) found.add(tok);
  }
  return [...found];
}

function textOf(msg) {
  const parts = [msg.content ?? ''];
  for (const e of msg.embeds ?? []) {
    parts.push(e.title ?? '', e.description ?? '');
    for (const f of e.fields ?? []) parts.push(f.name ?? '', f.value ?? '');
  }
  return parts.filter(Boolean).join('\n');
}

async function page(before) {
  const url = new URL(`https://discord.com/api/v10/channels/${channel}/messages`);
  url.searchParams.set('limit', '100');
  if (before) url.searchParams.set('before', before);
  const res = await fetch(url, { headers: { Authorization: `Bot ${token}` } });
  if (res.status === 429) {
    await new Promise((r) => setTimeout(r, Number(res.headers.get('retry-after') ?? 2) * 1000));
    return page(before);
  }
  if (!res.ok) throw new Error(`${res.status} ${(await res.text()).slice(0, 150)}`);
  return res.json();
}

const data = game ? await readJson(`${GAMES_DIR}/${game}.json`, null) : null;
const known = new Set((data?.codes ?? []).map((c) => c.code.toUpperCase()));
const nameWords = new Set((data?.name ?? '').toUpperCase().split(/[^A-Z0-9]+/).filter(Boolean));

const hits = new Map(); // code -> newest message that mentioned it
let before;
let read = 0;

while (read < limit) {
  const batch = await page(before);
  if (!batch.length) break;
  read += batch.length;
  before = batch[batch.length - 1].id;
  for (const msg of batch) {
    const text = textOf(msg);
    if (!text) continue;
    for (const code of codesIn(text)) {
      const up = code.toUpperCase();
      if (known.has(up) || nameWords.has(up) || hits.has(up)) continue;
      hits.set(up, {
        code,
        when: msg.timestamp?.slice(0, 10) ?? '',
        text: text.replace(/\s+/g, ' ').slice(0, 140),
      });
    }
  }
  if (batch.length < 100) break;
}

console.log(`Read ${read} messages, found ${hits.size} possible codes.`);
if (hits.size === 0) {
  await sendDiscord(
    `🔍 Scanned ${read} old messages${data ? ` for **${data.name}**` : ''} and found no new codes.`,
    'codes'
  );
} else {
  const lines = [...hits.values()]
    .map((h) => `\`${h.code}\`${h.when ? ` (${h.when})` : ''} — ${h.text}`)
    .slice(0, 25);
  await sendDiscord(
    `🔍 Scanned ${read} old messages${data ? ` for **${data.name}**` : ''}. Possible codes:\n` +
      lines.join('\n') +
      `\n\nTest them in-game, then publish the working ones with \`/code\`.`,
    'codes'
  );
}
