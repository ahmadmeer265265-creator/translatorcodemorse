export const primaryNav = [
  { href: '/', label: 'Home' },
  { href: '/morse-code-audio-translator/', label: 'Audio' },
  { href: '/morse-code-image-translator/', label: 'Image' },
  { href: '/american-morse-code-translator/', label: 'American' },
  { href: '/morse-code-machine/', label: 'Machine' },
  { href: '/morse-code-alphabet/', label: 'Alphabet' },
  { href: '/morse-code-numbers/', label: 'Numbers' },
  { href: '/sos-in-morse-code/', label: 'SOS' },
  { href: '/morse-code-speed-statistics/', label: 'Speed' },
] as const;

/** Top-level header items (Morse Tools is a separate disclosure). */
export const headerTopNav = [
  { href: '/', label: 'Home' },
  { href: '/morse-code-alphabet/', label: 'Alphabet' },
  { href: '/morse-code-numbers/', label: 'Numbers' },
  { href: '/sos-in-morse-code/', label: 'SOS' },
  { href: '/morse-code-speed-statistics/', label: 'Speed' },
] as const;

/** Morse Tools dropdown — real <a href> in the HTML, not JS-rendered. */
export const headerToolsNav = [
  { href: '/morse-code-audio-translator/', label: 'Audio Translator' },
  { href: '/morse-code-image-translator/', label: 'Image Translator' },
  { href: '/american-morse-code-translator/', label: 'American Morse Translator' },
  { href: '/morse-code-machine/', label: 'Morse Code Machine' },
] as const;
