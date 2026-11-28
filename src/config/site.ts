/**
 * The only site origin. Sitemap, canonical, and robots.txt all read this.
 * Change it before deploying.
 */
export const SITE_URL = 'https://translatorcodemorse.com';

export const SITE_NAME = 'Morse Code Translator';

/** Public contact address used by the Contact page mailto link. */
export const CONTACT_EMAIL = 'contact@translatorcodemorse.com';

/** Public Facebook profile URL for header/footer social icons and Organization sameAs. */
export const FACEBOOK_URL = 'https://www.facebook.com/profile.php?id=61595608020174';

/** Public Instagram profile URL for header/footer social icons and Organization sameAs. */
export const INSTAGRAM_URL = 'https://www.instagram.com/translatorcodemorse/';

/** Public YouTube channel for the publisher. */
export const YOUTUBE_URL = 'https://www.youtube.com/@mir_labs';

/** Public GitHub repository for this site. */
export const GITHUB_REPO_URL = 'https://github.com/ahmadmeer265265-creator/translatorcodemorse';

/**
 * Default Open Graph / Twitter share image (1200×630). Dark featured card —
 * crawlers have no theme, and most chat UIs preview on a dark/neutral surface.
 */
export const OG_IMAGE_PATH = '/og-default.jpg';
export const OG_IMAGE_WIDTH = 1200;
export const OG_IMAGE_HEIGHT = 630;
export const OG_IMAGE_ALT =
  'Morse Code Translator — text to Morse and back, with audio, tap input, and WAV download';

/**
 * Organization / schema logo — light 180×180 profile mark, served as a stable
 * same-origin public asset (apple-touch-icon.png).
 */
export const LOGO_PATH = '/apple-touch-icon.png';

/** Studio that publishes the site. Do not use this as SITE_NAME. */
export const PUBLISHER_NAME = 'Mir Labs';
export const PUBLISHER_URL = 'https://translatorcodemorse.com/';
export const PUBLISHER_LOGO = LOGO_PATH;
export const PUBLISHER_SAME_AS = [FACEBOOK_URL, INSTAGRAM_URL, YOUTUBE_URL, GITHUB_REPO_URL] as const;

/** Founder named on /about/. Person JSON-LD only. */
export const AUTHOR_NAME = 'Ahmad Mir';
export const AUTHOR_JOB_TITLE = 'Founder, Mir Labs';
export const PERSON_SAME_AS = [
  'https://github.com/ahmadmeer265265-creator',
  'https://dev.to/mir_labs_dev',
  'https://www.linkedin.com/in/ahmed-iftikhar-544704200/',
] as const;

/** Keep in sync with --canvas in src/styles/global.css */
export const THEME_COLOR = {
  light: '#f3efe8',
  dark: '#14110e',
} as const;

export function absoluteUrl(pathname: string): string {
  const base = SITE_URL.endsWith('/') ? SITE_URL : `${SITE_URL}/`;
  return new URL(pathname, base).href;
}
