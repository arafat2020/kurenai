import { defineConfig } from 'vitest/config';
import { playwright } from '@vitest/browser-playwright';

export default defineConfig({
  test: {
    projects: [
      {
        /**
         * Node project — all existing tests, completely unchanged.
         * Browser-specific files (*.browser.test.ts) are excluded so they
         * never run in a Node environment where WebCodecs APIs don't exist.
         */
        test: {
          name: 'node',
          globals: true,
          environment: 'node',
          include: ['tests/**/*.test.ts'],
          exclude: ['tests/**/*.browser.test.ts'],
        },
      },
      {
        /**
         * Browser project — new *.browser.test.ts files running in real
         * headless Chromium via Playwright. VideoEncoder, AudioEncoder, File,
         * Blob, URL, etc. are all natively available here.
         *
         * Vitest 4 requires a factory function from @vitest/browser-playwright
         * instead of the string "playwright".
         */
        test: {
          name: 'browser',
          globals: true,
          include: ['tests/**/*.browser.test.ts'],
          browser: {
            enabled: true,
            provider: playwright(),
            instances: [
              { browser: 'chromium' },
            ],
          },
        },
        // Pre-bundle heavy dependencies to prevent Vite reload flakiness
        optimizeDeps: {
          include: ['mediabunny', 'mp4-muxer'],
        },
      },
    ],
  },
});
