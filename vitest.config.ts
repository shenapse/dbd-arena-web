/// <reference types="vitest/config" />
// Unit tests (tests/unit/). getViteConfig gives the tests Astro's Vite setup,
// so .astro components can be rendered with the container API.
import { getViteConfig } from 'astro/config';

export default getViteConfig({
  test: {
    include: ['tests/unit/**/*.test.ts'],
  },
});
