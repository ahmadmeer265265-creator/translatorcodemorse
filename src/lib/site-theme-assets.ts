/**
 * One watcher for site theme (documentElement data-theme), not OS preference.
 * Drives favicon hrefs, the header logo slot, and the homepage feature slot.
 */
export type SiteTheme = 'light' | 'dark';

export function siteTheme(): SiteTheme {
  return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
}

function syncFavicons(theme: SiteTheme) {
  const suffix = theme === 'dark' ? '-dark' : '';
  for (const link of document.querySelectorAll<HTMLLinkElement>('link[rel="icon"][data-theme-icon]')) {
    const size = link.getAttribute('data-theme-icon');
    if (size !== '16' && size !== '32') continue;
    const href = `/favicon-${size}x${size}${suffix}.png`;
    if (link.getAttribute('href') === href) continue;
    // Replace the node so browsers that cache rel=icon pick up the swap.
    const next = link.cloneNode(true) as HTMLLinkElement;
    next.setAttribute('href', href);
    link.replaceWith(next);
  }
}

function fillThemeSlot(root: Element | null, theme: SiteTheme) {
  if (!root) return;
  const slot = root.querySelector('[data-theme-slot]');
  if (!slot) return;
  const live = slot.querySelector('[data-theme-src]');
  if (live?.getAttribute('data-theme-src') === theme) return;
  const tpl = root.querySelector(`template[data-theme-src="${theme}"]`);
  if (!(tpl instanceof HTMLTemplateElement)) return;
  slot.replaceChildren(tpl.content.cloneNode(true));
}

function featureIsNear(root: Element) {
  const box = root.getBoundingClientRect();
  return box.top < (window.innerHeight || 0) + 80 && box.bottom > -80;
}

export function initSiteThemeAssets() {
  const logo = document.querySelector('[data-theme-logo]');
  const feature = document.querySelector('[data-article-feature]');
  let featureReady = false;

  const apply = () => {
    const theme = siteTheme();
    syncFavicons(theme);
    fillThemeSlot(logo, theme);
    if (feature && featureReady) fillThemeSlot(feature, theme);
  };

  if (feature instanceof HTMLElement) {
    const arm = () => {
      if (featureReady || !featureIsNear(feature)) return;
      featureReady = true;
      io.disconnect();
      window.removeEventListener('scroll', arm);
      window.removeEventListener('resize', arm);
      apply();
    };
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) arm();
      },
      { rootMargin: '80px' },
    );
    io.observe(feature);
    window.addEventListener('scroll', arm, { passive: true });
    window.addEventListener('resize', arm);
    arm();
  }

  apply();
  new MutationObserver(apply).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme'],
  });
}
