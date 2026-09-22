// Reads new messages from your own Discord channels and looks for codes.
// Point it at channels where game announcements land (use Discord's "Follow"
// button on a game's announcement channel to pipe its posts into your server).
//
// Needs two repository secrets:
//   DISCORD_BOT_TOKEN  - a bot invited to your server with Read Messages + Read Message History
//   WATCH_CHANNELS     - comma-separated "channelId:game-slug" pairs, e.g. 123456:slayers-2,987654:ride-a-pet
import { GAMES_DIR, readJson, writeJson, sendDiscord } from './roblox.mjs';

const STATE = 'data/discord-state.json';
const token = process.env.DISCORD_BOT_TOKEN;
const watch = (process.env.WATCH_CHANNELS || '')
  .split(',')
  .map((pair) => pair.trim())
  .filter(Boolean)
  .map((pair) => {
    const [channel, game] = pair.split(':');
    return { channel: channel.trim(), game: (game || '').trim() };
  });

if (!token || watch.length === 0) {
  console.log('No bot token or no channels to watch. Nothing to do.');
  process.exit(0);
}

const IGNORE = new Set([
  'CODE', 'CODES', 'UPDATE', 'UPDATES', 'ROBLOX', 'DISCORD', 'GROUP', 'JOIN', 'LIKE', 'FREE', 'NEW',
  'REWARD', 'REWARDS', 'REDEEM', 'ACTIVE', 'EXPIRED', 'EVERYONE', 'HERE', 'ANNOUNCEMENT', 'PLAY',
  'THANKS', 'SERVER', 'GAME', 'PATCH', 'NOTES', 'SOON', 'HTTPS', 'ROBUX', 'GIVEAWAY',
]);

function codesIn(text = '') {
  const found = new Set();
  for (const line of text.split(/\r?\n/)) {
    if (!/code/i.test(line)) continue;
    const after = line.includes(':') ? line.slice(line.indexOf(':') + 1) : line;
    for (const tok of after.match(/[A-Za-z0-9_!]{4,30}/g) ?? []) {
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

// A followed announcement arrives as an embed, so read those fields too.
function textOf(msg) {
  const parts = [msg.content ?? ''];
  for (const e of msg.embeds ?? []) {
    parts.push(e.title ?? '', e.description ?? '');
    for (const f of e.fields ?? []) parts.push(f.name ?? '', f.value ?? '');
  }
  return parts.filter(Boolean).join('\n');
}

async function messagesSince(channel, afterId) {
  const url = new URL(`https://discord.com/api/v10/channels/${channel}/messages`);
  url.searchParams.set('limit', '50');
  if (afterId) url.searchParams.set('after', afterId);
  const res = await fetch(url, { headers: { Authorization: `Bot ${token}` } });
  if (res.status === 429) {
    const wait = Number(res.headers.get('retry-after') ?? 2) * 1000;
    await new Promise((r) => setTimeout(r, wait));
    return messagesSince(channel, afterId);
  }
  if (!res.ok) throw new Error(`Channel ${channel}: ${res.status} ${await res.text()}`);
  return (await res.json()).reverse(); // oldest first
}

const state = await readJson(STATE, {});
const alerts = [];

for (const { channel, game } of watch) {
  let messages;
  try {
    messages = await messagesSince(channel, state[channel]);
  } catch (err) {
    console.warn(err.message);
    continue;
  }
  if (!messages.length) continue;
  state[channel] = messages[messages.length - 1].id;

  // First run just records where we are, so you don't get pinged about old posts.
  if (!state.seeded?.[channel]) {
    state.seeded = { ...(state.seeded ?? {}), [channel]: true };
    console.log(`Channel ${channel}: starting point saved (${messages.length} messages skipped).`);
    continue;
  }

  const data = game ? await readJson(`${GAMES_DIR}/${game}.json`, null) : null;
  const known = new Set((data?.codes ?? []).map((c) => c.code.toUpperCase()));
  const label = data?.name ?? `channel ${channel}`;

  for (const msg of messages) {
    const text = textOf(msg);
    if (!text) continue;
    const fresh = codesIn(text).filter((c) => !known.has(c.toUpperCase()));
    if (fresh.length) {
      alerts.push(
        `🎁 **${label}** posted possible codes: ${fresh.map((c) => `\`${c}\``).join(', ')}\n` +
          `Check them in-game, then run the "Add a code" action${game ? ` with game \`${game}\`` : ''}.`
      );
    } else if (/update|patch|release|out now/i.test(text)) {
      alerts.push(`🔄 **${label}** posted an update. Worth checking for new codes.`);
    }
  }
}

await writeJson(STATE, state);
console.log(`${alerts.length} alerts from ${watch.length} channels.`);
if (alerts.length) await sendDiscord(alerts.slice(0, 15).join('\n\n'));
