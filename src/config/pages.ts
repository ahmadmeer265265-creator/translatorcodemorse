/**
 * Explicit last-updated dates for indexable pages.
 * Edit a date by hand only when that page's content materially changes.
 * Do not derive lastmod from file mtime (Cloudflare clones reset mtimes every build).
 */
export const pageMeta = [
  { path: '/', lastUpdated: '2026-10-07' },
  { path: '/morse-code-alphabet/', lastUpdated: '2026-10-07' },
  { path: '/morse-code-numbers/', lastUpdated: '2026-10-07' },
  { path: '/sos-in-morse-code/', lastUpdated: '2026-10-07' },
  { path: '/about/', lastUpdated: '2026-10-19' },
  { path: '/privacy/', lastUpdated: '2026-10-19' },
  { path: '/terms/', lastUpdated: '2026-10-19' },
  { path: '/accessibility/', lastUpdated: '2026-10-19' },
  { path: '/contact/', lastUpdated: '2026-10-19' },
] as const;

export type PagePath = (typeof pageMeta)[number]['path'];

export function lastUpdatedFor(path: string): string | undefined {
  return pageMeta.find((page) => page.path === path)?.lastUpdated;
}

export function lastUpdatedIso(path: string): string | undefined {
  const day = lastUpdatedFor(path);
  return day ? `${day}T00:00:00.000Z` : undefined;
}
