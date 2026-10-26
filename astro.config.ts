import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig, type Plugin } from 'astro/config';
import { lastUpdatedIso, pageMeta } from './src/config/pages';
import { SITE_URL } from './src/config/site';
import { hasPublishedBlogPosts } from './src/lib/published-blog';

const indexablePaths = new Set(pageMeta.map((page) => page.path));

/**
 * Bundle reconciliation (Stage 2.5). Two inline plugins keep a second page
 * entry from reshaping the homepage's chunk graph:
 *
 * 1. bare-dynamic-import: emit native import() for dynamic imports instead of
 *    Vite's __vitePreload wrapper, so the shared preload-helper chunk is
 *    never created. (modulePreload is already disabled; lazy chunks' own
 *    deps simply load on demand.)
 *
 * 2. at-instance-cascade: the audio-translator page imports some homepage
 *    modules with a `?at` query. Any import made BY a `?at` instance is
 *    re-resolved to a `?at` instance too, so the cloned graph is fully
 *    self-contained and the homepage's originals stay inlined in its own
 *    chunks. One source file, two bundle instances — no src duplication.
 */
/**
 * strip-preload-helper: Vite wraps every dynamic import in __vitePreload,
 * whose helper module gets hoisted into a shared chunk whenever two page
 * entries exist — that chunk then loads eagerly on the homepage. The
 * renderDynamicImport hook is overridden by Vite core, so this runs last
 * (generateBundle) and rewrites the wrapper call sites to native import(),
 * drops the helper import, and deletes the now-unreferenced helper chunk.
 * Lazy behavior is unchanged: modulePreload is disabled, so nothing was
 * preloaded anyway; the wrapper only existed for dep-preloading.
 */
const stripPreloadHelper: Plugin = {
  name: 'strip-preload-helper',
  apply: 'build',
  generateBundle(_options, bundle) {
    const helperFiles = Object.keys(bundle).filter((file) => file.includes('preload-helper'));
    if (helperFiles.length === 0) return;
    for (const item of Object.values(bundle)) {
      if (item.type !== 'chunk') continue;
      // e(()=>import(`./x.js`),[]) / e(()=>import(`./x.js`),__vite__mapDeps([0,1]))
      //   → import(`./x.js`)   (backtick/quote forms, optional .then() chain,
      //   deps array or __vite__mapDeps second arg dropped)
      item.code = item.code.replace(
        /[$\w]+\(\(\)=>(import\(`[^`]+`\)(?:\.then\([^)]*\))?|import\("[^"]+"\)(?:\.then\([^)]*\))?|import\('[^']+'\)(?:\.then\([^)]*\))?)(?:,(?:__vite__mapDeps\([^)]*\)|[^()])*)\)/g,
        '$1',
      );
      // import{t as e}from"./preload-helper.HASH.js"; (alias now unused) → gone
      item.code = item.code.replace(
        /import\s*\{[^}]*\}\s*from\s*["']\.\/[^"']*preload-helper[^"']*["'];?/g,
        '',
      );
    }
    for (const file of helperFiles) delete bundle[file];
  },
};

const atInstanceCascade: Plugin = {
  name: 'at-instance-cascade',
  enforce: 'pre',
  async resolveId(source, importer) {
    if (!importer || !importer.includes('?at')) return null;
    const cleanImporter = importer.split('?')[0]!;
    const resolved = await this.resolve(source, cleanImporter, { skipSelf: true });
    if (!resolved) return null;
    const id = resolved.id;
    if (id.includes('?') || id.includes('node_modules') || id.startsWith('\0')) return null;
    if (!id.includes('/src/') && !id.includes('\\src\\')) return null;
    return id + '?at';
  },
};

export default defineConfig({
  site: SITE_URL,
  output: 'static',
  trailingSlash: 'always',
  prefetch: false,
  compressHTML: true,
  markdown: {
    smartypants: false,
  },
  build: {
    format: 'directory',
    inlineStylesheets: 'always',
  },

  integrations: [
    mdx(),
    sitemap({
      filter: (page) => {
        const pathname = new URL(page).pathname;
        if (pathname.includes('/404')) return false;
        if (pathname.includes('/blog') && !hasPublishedBlogPosts()) return false;
        return indexablePaths.has(pathname);
      },
      serialize(item) {
        const pathname = new URL(item.url).pathname;
        const iso = lastUpdatedIso(pathname);
        if (iso) item.lastmod = iso;
        return item;
      },
    }),
  ],
  vite: {
    plugins: [tailwindcss(), atInstanceCascade, stripPreloadHelper],
    build: {
      modulePreload: false,
    },
  },
  image: {
    service: {
      entrypoint: 'astro/assets/services/sharp',
      config: {
        avif: { quality: 50, effort: 6 },
        webp: { quality: 75, effort: 6 },
      },
    },
  },
});
