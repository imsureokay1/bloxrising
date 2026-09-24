// Receives suggestions from the form on /about/ and posts them to Discord.
// The webhook URL lives in the Cloudflare Pages environment variable
// SUGGEST_WEBHOOK_URL, so it never appears in the site's code.

const MAX = { subject: 120, details: 1200, contact: 120 };

function clean(value, limit) {
  return String(value ?? '').trim().slice(0, limit);
}

export async function onRequestPost({ request, env }) {
  const json = (body, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' },
    });

  let data;
  try {
    data = await request.json();
  } catch {
    return json({ ok: false, error: 'Could not read that.' }, 400);
  }

  // Bots fill in every field they find; people never see this one.
  if (clean(data.website, 50)) return json({ ok: true });

  const subject = clean(data.subject, MAX.subject);
  const details = clean(data.details, MAX.details);
  const contact = clean(data.contact, MAX.contact);

  if (subject.length < 2) {
    return json({ ok: false, error: 'Tell us which game or guide you mean.' }, 400);
  }

  if (!env.SUGGEST_WEBHOOK_URL) {
    return json({ ok: false, error: 'Suggestions are offline right now.' }, 500);
  }

  const country = request.headers.get('cf-ipcountry') ?? '';
  const lines = [
    `💡 **Suggestion:** ${subject}`,
    details ? `> ${details.replace(/\n+/g, ' ')}` : '',
    contact ? `Contact: ${contact}` : '',
    country ? `From: ${country}` : '',
  ].filter(Boolean);

  const res = await fetch(env.SUGGEST_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      content: lines.join('\n').slice(0, 1900),
      allowed_mentions: { parse: [] },
    }),
  });

  if (!res.ok) return json({ ok: false, error: "That didn't send. Try again in a minute." }, 502);
  return json({ ok: true });
}
