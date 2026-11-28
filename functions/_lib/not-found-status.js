/**
 * Cloudflare Pages serves dist/404.html at /404 with status 200, because that
 * file is a real asset. _redirects cannot return 404: the only supported codes
 * are 200 and 301, 302, 303, 307, 308. This handler returns the same page with
 * status 404.
 */
export async function onRequest(context) {
  const url = new URL(context.request.url);
  url.pathname = '/404-body.txt';
  url.search = '';
  const request = new Request(url, { method: 'GET', redirect: 'manual' });
  const page = context.env?.ASSETS?.fetch
    ? await context.env.ASSETS.fetch(request)
    : await fetch(request);
  const headers = new Headers(page.headers);
  headers.delete('location');
  headers.set('content-type', 'text/html; charset=utf-8');
  return new Response(page.body, {
    status: 404,
    statusText: 'Not Found',
    headers,
  });
}
