// Registers the slash commands with Discord. Run it once (and again if you change them).
//   DISCORD_APP_ID=... DISCORD_BOT_TOKEN=... node scripts/register-commands.mjs
const appId = process.env.DISCORD_APP_ID;
const token = process.env.DISCORD_BOT_TOKEN;
// Setting DISCORD_GUILD_ID registers to that one server, which shows up instantly.
// Without it, commands register globally and can take up to an hour to appear.
const guildId = (process.env.DISCORD_GUILD_ID || '').trim();
if (!appId || !token) {
  console.error('Need DISCORD_APP_ID and DISCORD_BOT_TOKEN.');
  process.exit(1);
}

const commands = [
  {
    name: 'code',
    description: 'Publish a code to the site (or mark one expired)',
    options: [
      { name: 'game', description: 'Game file name, e.g. slayers-2', type: 3, required: true },
      { name: 'code', description: 'The code, exactly as the game shows it', type: 3, required: true },
      { name: 'reward', description: 'What it gives, e.g. 30 Spins', type: 3 },
      { name: 'expires', description: 'Expiry date, e.g. 2026-10-05', type: 3 },
      {
        name: 'status',
        description: 'active (default) or expired',
        type: 3,
        choices: [
          { name: 'active', value: 'active' },
          { name: 'expired', value: 'expired' },
        ],
      },
    ],
  },
  {
    name: 'game',
    description: 'Add a Roblox game to the site from its link',
    options: [{ name: 'url', description: 'Roblox game link', type: 3, required: true }],
  },
  {
    name: 'watch',
    description: 'Watch a Discord or YouTube channel for codes',
    options: [
      {
        name: 'source',
        description: 'Where the channel is',
        type: 3,
        required: true,
        choices: [
          { name: 'discord', value: 'discord' },
          { name: 'youtube', value: 'youtube' },
        ],
      },
      { name: 'id', description: 'Channel ID', type: 3, required: true },
      { name: 'game', description: 'Game file name this channel is about', type: 3 },
    ],
  },
];

const endpoint = guildId
  ? `https://discord.com/api/v10/applications/${appId}/guilds/${guildId}/commands`
  : `https://discord.com/api/v10/applications/${appId}/commands`;

const res = await fetch(endpoint, {
  method: 'PUT',
  headers: { authorization: `Bot ${token}`, 'content-type': 'application/json' },
  body: JSON.stringify(commands),
});
console.log(guildId ? `Registered to server ${guildId}` : 'Registered globally');
console.log(res.status, (await res.text()).slice(0, 400));
