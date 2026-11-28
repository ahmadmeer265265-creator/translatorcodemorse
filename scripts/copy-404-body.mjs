/**
 * Cloudflare pretty-URL handling redirects /404.html to /404, so a Pages
 * Function cannot read that file without looping. Keep a non-HTML copy for
 * the /404 status handler.
 */
import fs from 'node:fs';

fs.copyFileSync('dist/404.html', 'dist/404-body.txt');
