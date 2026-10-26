import { getViteConfig } from 'astro/config';

// getViteConfig wires the Astro Vite plugin so component (.astro) tests can
// import and render components with the container API; pure lib tests are
// unaffected.
export default getViteConfig({
  test: {
    include: ['src/**/*.test.ts'],
  },
});
