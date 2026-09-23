# How we write EarlySpawn

These rules apply to every page on the site. AI helps draft and maintain pages;
that isn't hidden, and it doesn't lower the bar. A page ships only if a real
Roblox player would find it worth bookmarking.

## Content rules

1. No mass-generated pages made to chase keywords.
2. Nothing copied, scraped, or lightly reworded from other Roblox sites.
3. Every page has to teach a player something useful.
4. First-hand detail wherever possible: steps actually tested, our own
   screenshots, where a code or item was found, when it was checked, what the
   update actually changed, exact requirements, and what did not work.
5. Never invent information. If something isn't known, the page says it isn't
   known.
6. Code pages make the essentials obvious: active codes, expired codes, the
   reward for each, and the date the list was last checked.
7. One clear purpose per page. No two pages chasing near-identical searches.
8. Written for players, not for search engines. No keyword stuffing, no padding.
9. Headings describe what's under them.
10. Related EarlySpawn pages link to each other.
11. Images are added when they explain something, not for decoration.
12. Updating a page means changing the information, never only the date.
13. Useful existing content is kept rather than rewritten by default.
14. Accuracy and usefulness beat length, always.

## Codes

- Verify before publishing whenever possible. `/code` stamps the check date.
- Show the reward for each code, or say the reward isn't confirmed.
- Keep active and expired codes separate.
- Never invent a code.
- When there's nothing working, say so plainly and explain why
  (`codesNote` in the game's JSON file).

## Update posts

- State exactly what changed, with the update date when known.
- Explain how to get the new content, including requirements and locations.
- Include codes when relevant, and link the game's codes page.
- Link to guides that already exist.
- Separate confirmed information from rumours and leaks, clearly.

## Technical

Handled by the site itself, but worth keeping true:

- Unique title and meta description per page.
- One H1 per page.
- Canonical URL on every page.
- XML sitemap at /sitemap-index.xml, robots.txt allowing search crawlers.
- Visible breadcrumbs, plus matching BreadcrumbList structured data.
- Article structured data on guides only, with the real updated date.
- Static HTML: content is in the page, not loaded by scripts.
- Two or three ad slots per page, between sections. No popups or interstitials.

## Growth

Build a small number of genuinely useful pages first, then expand based on real
games, updates and searches. Ten excellent pages beat a hundred thin ones.
