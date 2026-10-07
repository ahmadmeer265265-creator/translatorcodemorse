import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'astro/config';
import { lastUpdatedIso, pageMeta } from './src/config/pages';
import { SITE_URL } from './src/config/site';
import { hasPublishedBlogPosts } from './src/lib/published-blog';

const indexablePaths = new Set(pageMeta.map((page) => page.path));

export default defineConfig({
  site: SITE_URL,
  output: 'static',
  trailingSlash: 'always',
  prefetch: false,
  compressHTML: true,
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
    plugins: [tailwindcss()],
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
