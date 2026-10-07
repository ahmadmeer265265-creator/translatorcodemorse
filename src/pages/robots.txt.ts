import type { APIRoute } from 'astro';
import { absoluteUrl } from '../config/site';

export const GET: APIRoute = () => {
  const body = `User-agent: *\nAllow: /\n\nSitemap: ${absoluteUrl('/sitemap-index.xml')}\n`;

  return new Response(body, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
    },
  });
};
