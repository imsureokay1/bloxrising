// Watches game developers' YouTube channels for new videos, using the free RSS
// feed every channel has (no API key, no quota).
//
// Channels come from the /watch command (data/watch.json), or from the
// WATCH_YOUTUBE secret as "channelId:game-slug" pairs.
import { GAMES_DIR, readJson, writeJson, sendDiscord } from './roblox.mjs';

const STATE = 'data/youtube-state.json';
const WATCH_FILE = 'data/watch.json';

const fromFile = ((await readJson(WATCH_FILE, {})).youtube ?? []).map((w) => ({
  channel: String(w.id),
  game: w.game ?? '',
}));
const fromSecret = (process.env.WATCH_YOUTUBE || '')
  .split(',')
  .map((p) => p.trim())
  .filter(Boolean)
  .map((p) => {
    const [channel, game] = p.split(':');
    return { channel: channel.trim(), game: (game || '').trim() };
  });
const watch = [...fromFile, ...fromSecret].filter(
  (w, i, all) => w.channel && all.findIndex((o) => o.channel === w.channel) === i
);

if (watch.length === 0) {
  console.log('No YouTube channels to watch. Nothing to do.');
  process.exit(0);
}

const IGNORE = new Set([
  'CODE', 'CODES', 'UPDATE', 'UPDATES', 'ROBLOX', 'NEW', 'FREE', 'ALL', 'WORKING', 'SHOWCASE',
  'TRAILER', 'RELEASE', 'RELEASED', 'SOON', 'PART', 'EVENT', 'GAME', 'FULL', 'BEST', 'GUIDE',
  'LIVE', 'HERE', 'THIS', 'THAT', 'WITH', 'FROM', 'YOUR', 'MORE',
]);

function codesIn(text = '') {
  const found = new Set();
  const cleaned = text.replace(/https?:\/\/\S+/g, ' ').replace(/[*_~`|]/g, ' ');
  const mentions = /\b(code|codes|redeem|use|enter|type)\b/i.test(cleaned);
  for (const tok of cleaned.match(/[A-Za-z0-9_!]{4,30}/g) ?? []) {
    const up = tok.toUpperCase();
    if (IGNORE.has(up.replace(/!/g, '')) || !/[A-Za-z]/.test(tok)) continue;
    const allCaps = tok === up && tok.length >= 5;
    const hasDigit = /\d/.test(tok);
    const camel = /[a-z][A-Z]/.test(tok) && tok.length >= 6;
    const strong = allCaps && hasDigit;
    if (strong || (mentions && (allCaps || camel))) found.add(tok);
  }
  return [...found];
}

// Pulls <entry> blocks out of the channel's Atom feed.
function entriesFrom(xml) {
  return [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)].map((m) => {
    const block = m[1];
    const pick = (tag) => (block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`)) ?? [])[1] ?? '';
    return {
      id: pick('yt:videoId'),
      title: decode(pick('title')),
      description: decode(pick('media:description')),
      published: pick('published'),
    };
  });
}

function decode(s) {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .trim();
}

const state = await readJson(STATE, {});
const codeAlerts = [];
const updateAlerts = [];
const DAY = 24 * 60 * 60 * 1000;

for (const { channel, game } of watch) {
  let xml;
  try {
    const res = await fetch(`https://www.youtube.com/feeds/videos.xml?channel_id=${channel}`);
    if (!res.ok) throw new Error(`${channel}: ${res.status}`);
    xml = await res.text();
  } catch (err) {
    console.warn(err.message);
    continue;
  }

  const entries = entriesFrom(xml).reverse(); // oldest first
  const seen = new Set(state[channel] ?? []);
  const fresh = entries.filter((e) => e.id && !seen.has(e.id));
  // Keep the last 30 video ids per channel so the file stays small.
  state[channel] = entries.map((e) => e.id).slice(-30);

  if (!state.seeded?.[channel]) {
    state.seeded = { ...(state.seeded ?? {}), [channel]: true };
    console.log(`${channel}: starting point saved (${entries.length} videos skipped).`);
    continue;
  }

  const data = game ? await readJson(`${GAMES_DIR}/${game}.json`, null) : null;
  const known = new Set((data?.codes ?? []).map((c) => c.code.toUpperCase()));
  // Words from the game's own name aren't codes ("SLAYERS 2 UPDATE IS HERE").
  const nameWords = new Set((data?.name ?? '').toUpperCase().split(/[^A-Z0-9]+/).filter(Boolean));
  const label = data?.name ?? channel;

  for (const v of fresh) {
    // Skip anything older than a week, in case a feed backfills.
    if (v.published && Date.now() - Date.parse(v.published) > 7 * DAY) continue;
    const text = `${v.title}\n${v.description}`;
    const codes = codesIn(text).filter(
      (c) => !known.has(c.toUpperCase()) && !nameWords.has(c.toUpperCase())
    );
    const link = `https://www.youtube.com/watch?v=${v.id}`;
    if (codes.length) {
      codeAlerts.push(
        `🎁 **${label}** dev video mentions possible codes: ${codes.map((c) => `\`${c}\``).join(', ')}\n` +
          `${v.title}\n${link}\n` +
          `Check them in-game, then run \`/code\`${game ? ` with game \`${game}\`` : ''}.`
      );
    } else {
      updateAlerts.push(`📺 **${label}** dev posted a video: ${v.title}\n${link}`);
    }
  }
}

await writeJson(STATE, state);
console.log(`${codeAlerts.length} code alerts, ${updateAlerts.length} update alerts from ${watch.length} channels.`);
if (codeAlerts.length) await sendDiscord(codeAlerts.slice(0, 10).join('\n\n'), 'codes');
if (updateAlerts.length) await sendDiscord(updateAlerts.slice(0, 10).join('\n\n'), 'updates');
