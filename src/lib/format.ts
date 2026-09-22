// Turns "2026-09-21" into "Sep 21, 2026".
export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return '';
  const d = typeof value === 'string' ? new Date(value + (value.length === 10 ? 'T12:00:00Z' : '')) : value;
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}

export function monthYear(value?: string | null): string {
  const d = value ? new Date(value + (value.length === 10 ? 'T12:00:00Z' : '')) : new Date();
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
}

// Picks a stable colour for a game's letter tile.
const tiles = ['#2A2D35', '#0E7A43', '#6B3FA0', '#B4541A', '#1C5FA8', '#8A2B45'];
export function tileColor(name: string): string {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return tiles[h % tiles.length];
}
