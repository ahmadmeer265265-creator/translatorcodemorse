import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

process.env.PLAYWRIGHT_BROWSERS_PATH ??= 'D:\\pw-browsers';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
const MIME = { '.html':'text/html','.js':'text/javascript','.css':'text/css','.webp':'image/webp','.avif':'image/avif','.png':'image/png','.svg':'image/svg+xml' };

const server = http.createServer((req,res)=>{
  let p = decodeURIComponent((req.url||'/').split('?')[0]);
  if (p.endsWith('/')) p += 'index.html';
  fs.readFile(path.join(dist,p),(e,d)=>{ if(e){res.writeHead(404);res.end();return;} res.writeHead(200,{'content-type':MIME[path.extname(p)]||'application/octet-stream'}); res.end(d); });
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const port = server.address().port;
const base = `http://127.0.0.1:${port}`;

const browser = await chromium.launch();
const page = await (await browser.newContext()).newPage();
const thirdParty = [];
page.on('request', (req) => { const u = req.url(); if (!u.startsWith(base) && !u.startsWith('data:') && !u.startsWith('blob:')) thirdParty.push(u); });
await page.addInitScript(() => { window.__cls = 0; new PerformanceObserver((list)=>{ for (const e of list.getEntries()) if(!e.hadRecentInput) window.__cls += e.value; }).observe({ type:'layout-shift', buffered:true }); });

await page.goto(`${base}/`, { waitUntil:'networkidle' });
await page.waitForTimeout(1200);
const cls = await page.evaluate(()=>window.__cls);
await page.locator('input[data-mode][value="mic-listen"]').evaluate((el)=>el.click());
await page.waitForTimeout(800);
const clsAfterMic = await page.evaluate(()=>window.__cls);

const lum = (hex)=>{ const c=hex.trim().replace('#',''); const r=parseInt(c.substr(0,2),16)/255,g=parseInt(c.substr(2,2),16)/255,b=parseInt(c.substr(4,2),16)/255; const f=(v)=>v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4); return 0.2126*f(r)+0.7152*f(g)+0.0722*f(b); };
const ratio = (a,b)=>{ const l1=lum(a),l2=lum(b); return ((Math.max(l1,l2)+0.05)/(Math.min(l1,l2)+0.05)).toFixed(2); };

const light = await page.evaluate(() => { const cs=getComputedStyle(document.documentElement); const bar=document.querySelector('[data-mic-bar]'); return { accent:cs.getPropertyValue('--accent').trim(), surface:cs.getPropertyValue('--surface').trim(), canvas:cs.getPropertyValue('--canvas').trim(), barBg: bar?getComputedStyle(bar).backgroundColor:null }; });

console.log('CLS on load:', cls);
console.log('CLS after selecting mic mode:', clsAfterMic);
console.log('light colors:', JSON.stringify(light));
console.log('light accent-vs-canvas:', ratio(light.accent, light.canvas), ' accent-vs-surface:', ratio(light.accent, light.surface));
console.log('THIRD-PARTY requests on full load+mic:', thirdParty.length, JSON.stringify(thirdParty.slice(0,6)));

await page.emulateMedia({ colorScheme:'dark' });
await page.reload({ waitUntil:'networkidle' });
await page.locator('input[data-mode][value="mic-listen"]').evaluate((el)=>el.click());
await page.waitForTimeout(500);
const dark = await page.evaluate(() => { const cs=getComputedStyle(document.documentElement); return { accent:cs.getPropertyValue('--accent').trim(), surface:cs.getPropertyValue('--surface').trim(), canvas:cs.getPropertyValue('--canvas').trim() }; });
console.log('dark colors:', JSON.stringify(dark));
console.log('dark accent-vs-surface:', ratio(dark.accent, dark.surface), ' accent-vs-canvas:', ratio(dark.accent, dark.canvas));

await browser.close(); server.close();
