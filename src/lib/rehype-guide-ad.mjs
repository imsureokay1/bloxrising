// Puts one ad inside each guide, right before its second section, so readers
// always get the intro and the first useful section before any ad.
// Guides with fewer than two sections get no in-content ad.
// Does nothing until an AdSense client and the guideAfterIntro slot are set in src/data/ads.json.
import ads from '../data/ads.json' with { type: 'json' };

export default function rehypeGuideAd() {
  return (tree) => {
    const slot = ads.slots?.guideAfterIntro;
    if (!ads.client || !slot) return;
    const children = tree.children ?? [];
    let seen = 0;
    let at = -1;
    for (let i = 0; i < children.length; i++) {
      const n = children[i];
      if (n.type === 'element' && n.tagName === 'h2') {
        seen++;
        if (seen === 2) { at = i; break; }
      }
    }
    if (at < 0) return;
    const ad = {
      type: 'element',
      tagName: 'div',
      properties: { className: ['ad'] },
      children: [
        {
          type: 'element',
          tagName: 'ins',
          properties: {
            className: ['adsbygoogle'],
            style: 'display:block;width:100%',
            dataAdClient: ads.client,
            dataAdSlot: slot,
            dataAdFormat: 'auto',
            dataFullWidthResponsive: 'true',
          },
          children: [],
        },
        {
          type: 'element',
          tagName: 'script',
          properties: {},
          children: [{ type: 'text', value: '(window.adsbygoogle = window.adsbygoogle || []).push({});' }],
        },
      ],
    };
    children.splice(at, 0, ad);
  };
}
