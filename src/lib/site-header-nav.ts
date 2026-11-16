/**
 * Header-only navigation behavior (mobile panel + Morse Tools disclosure).
 * Imported solely from Header.astro so it cannot land in the homepage
 * translator chunk (Translator.astro_…_BFwF2DBv.js).
 */
export function initSiteHeaderNav() {
  const header = document.querySelector('[data-site-header]');
  const toggle = header?.querySelector('[data-nav-toggle]');
  const panel = header?.querySelector('[data-nav-panel]');
  const menuIcon = toggle?.querySelector('.icon-menu');
  const closeIcon = toggle?.querySelector('.icon-close');

  if (header instanceof HTMLElement && toggle instanceof HTMLButtonElement && panel instanceof HTMLElement) {
    const panelFocusable = () =>
      [...panel.querySelectorAll<HTMLElement>('a[href], button:not([disabled])')].filter(
        (el) => !el.hasAttribute('disabled') && el.getAttribute('aria-hidden') !== 'true',
      );

    const setOpen = (open: boolean) => {
      const wasOpen = toggle.getAttribute('aria-expanded') === 'true';
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
      panel.hidden = !open;
      if (menuIcon instanceof SVGElement) menuIcon.toggleAttribute('hidden', open);
      if (closeIcon instanceof SVGElement) closeIcon.toggleAttribute('hidden', !open);
      if (open) {
        const first = panelFocusable()[0];
        first?.focus();
      } else if (wasOpen) {
        toggle.focus();
      }
    };

    toggle.addEventListener('click', () => {
      setOpen(toggle.getAttribute('aria-expanded') !== 'true');
    });

    panel.addEventListener('click', (event) => {
      const target = event.target;
      if (target instanceof Element && target.closest('a')) setOpen(false);
    });

    panel.addEventListener('keydown', (event) => {
      if (event.key !== 'Tab' || panel.hidden) return;
      const items = panelFocusable();
      if (items.length === 0) return;
      const first = items[0]!;
      const last = items[items.length - 1]!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') setOpen(false);
    });

    const desktop = window.matchMedia('(min-width: 768px)');
    desktop.addEventListener('change', () => {
      if (desktop.matches) setOpen(false);
    });
  }

  const desktopMq = window.matchMedia('(min-width: 768px)');
  const toolsMenus = [...(header?.querySelectorAll('[data-nav-tools]') ?? [])].filter(
    (el): el is HTMLDetailsElement => el instanceof HTMLDetailsElement,
  );

  const syncExpanded = (el: HTMLDetailsElement) => {
    const summary = el.querySelector('summary');
    summary?.setAttribute('aria-expanded', el.open ? 'true' : 'false');
  };

  const closeTools = () => {
    for (const el of toolsMenus) {
      el.open = false;
      syncExpanded(el);
    }
  };

  for (const el of toolsMenus) {
    const summary = el.querySelector('summary');
    summary?.setAttribute('aria-haspopup', 'menu');
    syncExpanded(el);
    el.addEventListener('toggle', () => syncExpanded(el));
    el.addEventListener('mouseenter', () => {
      if (!desktopMq.matches) return;
      el.open = true;
      syncExpanded(el);
    });
    el.addEventListener('mouseleave', () => {
      if (!desktopMq.matches) return;
      el.open = false;
      syncExpanded(el);
    });
  }

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeTools();
  });

  document.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof Node)) return;
    if (toolsMenus.some((el) => el.contains(target))) return;
    closeTools();
  });

  desktopMq.addEventListener('change', () => {
    if (!desktopMq.matches) closeTools();
  });
}
