// Site-wide settings. Edit these, then save.
import ads from './data/ads.json';

export const site = {
  name: 'EarlySpawn',
  url: 'https://earlyspawn.com',
  tagline: 'Codes, beginner guides and game info for Roblox games that are gaining players.',
  email: 'contact@earlyspawn.com',

  // Shown as the byline on codes pages and guides, and used in structured data.
  // If you'd rather use your own creator name or handle, change name and set type to 'Person'.
  author: {
    name: 'EarlySpawn',
    type: 'Organization' as 'Organization' | 'Person',
    url: 'https://earlyspawn.com/about/',
  },

  // Your social links. Leave '' to hide one.
  socials: {
    tiktok: 'https://www.tiktok.com/@earlyspawn',
    youtube: '',
    x: '',
    discord: '',
  },

  // AdSense settings live in src/data/ads.json.
  adsenseClient: ads.client,
};
