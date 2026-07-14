import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/vitest.setup.js'],
    globals: true,
    include: ['src/**/*.test.js'],
    environmentOptions: {
      jsdom: {
        url: 'http://localhost',
      },
    },
    coverage: {
      provider: 'v8',
      include: ['src/**/*.js'],
      exclude: ['src/**/*.test.js', 'src/wailsjs/**'],
      reporter: ['text', 'lcov'],
    },
  },
})
