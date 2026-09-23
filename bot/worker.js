// EarlySpawn Discord bot, hosted free on Cloudflare Workers.
// Slash commands turn into GitHub Actions runs, so /code publishes to the site.
//
// Worker settings (Cloudflare dashboard -> your Worker -> Settings -> Variables):
//   DISCORD_PUBLIC_KEY  - from the Discord developer portal (General Information)
//   GITHUB_TOKEN        - a fine-grained token with Actions: read and write on your repo (encrypt it)
//   GITHUB_REPO         - e.g. imsureokay1/bloxrising
const PONG = { type: 1 };
const MESSAGE = 4; // reply immediately

function reply(content) {
  return new Response(JSON.stringify({ type: MESSAGE, data: { content, flags: 64 } }), {
    headers: { 'content-type': 'application/json' },
  });
}

function hexToBytes(hex) {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

async function verify(request, body, publicKey) {
  const signature = request.headers.get('x-signature-ed25519');
  const timestamp = request.headers.get('x-signature-timestamp');
  if (!signature || !timestamp) return false;
  const key = await crypto.subtle.importKey('raw', hexToBytes(publicKey), { name: 'Ed25519' }, false, ['verify']);
  return crypto.subtle.verify(
    { name: 'Ed25519' },
    key,
    hexToBytes(signature),
    new TextEncoder().encode(timestamp + body)
  );
}

// Starts a workflow in your repo and passes the command's values as inputs.
async function runWorkflow(env, file, inputs) {
  const res = await fetch(
    `https://api.github.com/repos/${env.GITHUB_REPO}/actions/workflows/${file}/dispatches`,
    {
      method: 'POST',
      headers: {
        authorization: `Bearer ${env.GITHUB_TOKEN}`,
        accept: 'application/vnd.github+json',
        'content-type': 'application/json',
        'user-agent': 'earlyspawn-bot',
      },
      body: JSON.stringify({ ref: 'main', inputs }),
    }
  );
  if (!res.ok) throw new Error(`GitHub said ${res.status}: ${(await res.text()).slice(0, 200)}`);
}

function option(data, name) {
  const found = (data.options ?? []).find((o) => o.name === name);
  return found ? String(found.value).trim() : '';
}

export default {
  async fetch(request, env) {
    if (request.method !== 'POST') return new Response('EarlySpawn bot is running.', { status: 200 });

    const body = await request.text();
    if (!(await verify(request, body, env.DISCORD_PUBLIC_KEY))) {
      return new Response('Bad signature', { status: 401 });
    }

    const interaction = JSON.parse(body);
    if (interaction.type === 1) {
      return new Response(JSON.stringify(PONG), { headers: { 'content-type': 'application/json' } });
    }
    if (interaction.type !== 2) return new Response('ok');

    const name = interaction.data.name;
    try {
      if (name === 'code') {
        const game = option(interaction.data, 'game').toLowerCase();
        const code = option(interaction.data, 'code');
        await runWorkflow(env, 'add-code.yml', {
          game,
          code,
          reward: option(interaction.data, 'reward'),
          expires: option(interaction.data, 'expires'),
          status: option(interaction.data, 'status') || 'active',
        });
        return reply(`Publishing \`${code}\` for **${game}**. It'll be live in a couple of minutes.`);
      }

      if (name === 'game') {
        await runWorkflow(env, 'add-game.yml', { url: option(interaction.data, 'url') });
        return reply("Adding that game. Its page goes live in a couple of minutes.");
      }

      if (name === 'watch') {
        await runWorkflow(env, 'add-watch.yml', {
          source: option(interaction.data, 'source') || 'discord',
          id: option(interaction.data, 'id'),
          game: option(interaction.data, 'game').toLowerCase(),
        });
        return reply('Added to the watch list. New posts there will be checked for codes.');
      }

      return reply('Unknown command.');
    } catch (err) {
      return reply(`That didn't work: ${err.message}`);
    }
  },
};
