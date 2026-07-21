import type { KnipConfig } from 'knip'

const config: KnipConfig = {
  ignore: [
    'src/types/matrix-js-sdk-augmentations.d.ts',
    // Storybook mocks are referenced via Vite resolve.alias in .storybook/aliases.ts,
    // not via static imports — knip cannot trace them.
    '.storybook/mocks/**'
  ],
  ignoreDependencies: ['matrix-js-sdk'],
  entry: [
    'src/main.ts',
    // Build/tooling configs (knip doesn't scan config files by default;
    // declaring them as entries lets knip trace vite/uno/vitest plugin deps)
    'vite.config.ts',
    'uno.config.ts',
    'vitest.config.ts',
    'playwright.config.ts',
    '.release-it.js',
    // Storybook entries (suppresses false "unused" reports for .storybook/mocks/*)
    '.storybook/main.ts',
    '.storybook/preview.ts',
    '.storybook/harness.ts',
    '.storybook/setup-file.ts',
    '.storybook/mock-data.ts',
    '.storybook/perf.ts'
  ],
  project: ['src/**/*.{ts,tsx,vue}'],
  ignoreBinaries: ['depcheck']
}

export default config
