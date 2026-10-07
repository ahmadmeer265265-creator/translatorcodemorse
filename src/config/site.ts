/**
 * The only site origin. Sitemap, canonical, and robots.txt all read this.
 * Change it before deploying.
 */
export const SITE_URL = 'https://translatorcodemorse.com';

export const SITE_NAME = 'Morse Code Translator';

/** Public contact address used by the Contact page mailto link. */
export const CONTACT_EMAIL = 'contact@translatorcodemorse.com';

/** Default Open Graph / Twitter share image (1200×630). */
export const OG_IMAGE_PATH = '/og-default.png';
export const OG_IMAGE_WIDTH = 1200;
export const OG_IMAGE_HEIGHT = 630;
export const OG_IMAGE_ALT = 'Morse Code Translator';

/** Keep in sync with --canvas in src/styles/global.css */
export const THEME_COLOR = {
  light: '#f4f6f8',
  dark: '#0e1218',
} as const;

export function absoluteUrl(pathname: string): string {
  const base = SITE_URL.endsWith('/') ? SITE_URL : `${SITE_URL}/`;
  return new URL(pathname, base).href;
}
