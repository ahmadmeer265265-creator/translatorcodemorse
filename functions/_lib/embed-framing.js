/**
 * Cloudflare Pages merges every matching _headers rule, so the site-wide
 * frame-ancestors 'none' and X-Frame-Options: DENY still apply to the embed
 * paths. This handler runs only on those routes and returns one frameable CSP.
 */
function contentSecurityPolicies(headers) {
  const values = [];
  headers.forEach((value, key) => {
    if (key.toLowerCase() === 'content-security-policy') values.push(value);
  });
  // Duplicate CSP headers are separate policies. The Headers API may already
  // have joined them with a comma; split only at the next policy's default-src.
  return values.flatMap((value) => value.split(/,\s*(?=default-src\s)/));
}

export async function onRequest(context) {
  const response = await context.next();
  const headers = new Headers(response.headers);
  headers.delete('X-Frame-Options');

  const policies = contentSecurityPolicies(headers);
  headers.delete('Content-Security-Policy');

  const sitePolicy = policies.find((value) => value.includes("frame-ancestors 'none'")) ?? policies[0];
  if (sitePolicy) {
    headers.set('Content-Security-Policy', sitePolicy.replaceAll("frame-ancestors 'none'", 'frame-ancestors *'));
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
