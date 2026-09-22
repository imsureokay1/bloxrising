# EarlySpawn

The earlyspawn.com website, built with [Astro](https://astro.build).

## Preview it (no install)

1. Upload this folder to a new GitHub repository (github.com → New repository → "uploading an existing file" → drag in everything inside this folder).
2. Open `https://stackblitz.com/github/YOUR-USERNAME/YOUR-REPO` in your browser.
3. StackBlitz installs everything and shows a live preview. Edit files there and the preview updates instantly.

## Preview it on your computer (optional)

Needs Node.js 18.20+ (LTS from nodejs.org).

```
npm install
npm run dev
```

Then open http://localhost:4321

## Put it live on Cloudflare Pages

1. Cloudflare dashboard → Workers & Pages → Create → Pages → Connect to Git → pick your repo.
2. Framework preset: **Astro**. Build command: `npm run build`. Output folder: `dist`.
3. After the first deploy: Custom domains → add `earlyspawn.com` (and `www.earlyspawn.com`). Let Cloudflare replace the old parking records.

Every change you push to GitHub goes live automatically.

## Everyday edits

**Update codes:** edit the game's file in `src/data/games/`, e.g. `slayers-2.json`.
- Add a code: `{ "code": "NEWCODE", "reward": "50 Spins", "status": "active" }`
- Expire a code: change its `"status"` to `"expired"`.
- After checking codes in-game, set `"lastChecked"` to today's date, like `"2026-09-22"`. Until then the page shows "Codes not checked in-game yet".

**Add a new game:** copy `slayers-2.json`, rename it, and fill it in. The file name becomes the URLs, e.g. `last-stop.json` creates:
- `/games/last-stop/`: the game's hub page (codes preview, guides, about, quick facts)
- `/codes/last-stop/`: the full codes page

**About the game:** in the game's file, `about` is the "About" text (separate paragraphs with `\n\n`), and `quickFacts` is the list of label/value pairs shown in the side box. `genre` and `released` show under the game's name.

**Rising this week:** set `"rising"` to the game's position (1 = top) and `"players"` to text like `"150K playing"`. Use `null` to leave a game off the list.

**Add a guide, update post, or tier list:** add a `.md` file in `src/content/guides/`. Copy the top section (between the `---` lines) from an existing guide, set `game` to the game's file name, and set `kind` to `guide`, `spotlight`, `update`, or `tier-list`. It shows up on the game's hub page automatically.

**Site settings:** `src/site.config.ts` holds the email, social links, and your AdSense publisher ID.

## Ads

Ad slots show as grey boxes while you preview and are hidden on the live site. Once AdSense approves you:
1. Put your publisher ID in `src/site.config.ts` (`adsenseClient`).
2. Create ad units in AdSense and pass their IDs to the slots, e.g. `<AdSlot size="rect" slot="1234567890" />`.
3. Add an `ads.txt` file in `public/` with the line AdSense gives you.

## Before you publish

- Check the Slayers 2 codes in the game's menu, fill in the rewards, and set `lastChecked`.
- Read through the Privacy Policy (`src/pages/privacy.astro`). It covers AdSense basics but isn't legal advice.

## Automation (GitHub Actions)

Two robots live in `.github/workflows/`. They run on GitHub's servers for free.

**Track games** (every 3 hours, automatic)
- Updates each game's player count and the "Rising this week" ranking on the site.
- Pings your Discord when a game updates, changes its description, shows possible new codes, or takes over #1 rising.
- Commits the new numbers, so the live site updates by itself (about 8 builds a day, well inside Cloudflare's free 500 a month).

**Add a game** (you start it)
- GitHub → your repo → Actions → "Add a game" → Run workflow → paste the Roblox link → Run.
- Creates the game's file, downloads its icon, and the page goes live a couple of minutes later.
- Then check its codes in-game and fill in the About section and guides.

### One-time setup
1. **Discord alerts:** In your Discord server: Server Settings → Integrations → Webhooks → New Webhook → pick a channel → Copy Webhook URL.
2. **Save it as a secret:** GitHub repo → Settings → Secrets and variables → Actions → New repository secret. Name: `DISCORD_WEBHOOK_URL`, value: the URL. Never paste it into a file.
3. **Allow the robots to save:** Settings → Actions → General → Workflow permissions → "Read and write permissions" → Save.
4. **First run:** Actions → "Track games" → Run workflow. The first run records a starting point; alerts start from the second run.

Codes are never published automatically. The robot only suggests them, since codes found in descriptions can be old or fake. You check them in-game and add them.
