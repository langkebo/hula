import type { KnipConfig } from 'knip'

const config: KnipConfig = {
  ignore: [
    // Storybook mocks are referenced via Vite resolve.alias in .storybook/aliases.ts,
    // not via static imports — knip cannot trace them.
    '.storybook/mocks/**'
  ],
  ignoreDependencies: ['matrix-js-sdk'],
  entry: [
    'src/main.ts',
    // Build/tooling configs (knip doesn't scan config files by default;
    // declaring them as entries lets knip trace vite/uno/vitest plugin deps)
    'uno.config.ts',
    // Storybook entries (suppresses false "unused" reports for .storybook/mocks/*)
    '.storybook/harness.ts',
    '.storybook/mock-data.ts',
    '.storybook/perf.ts'
  ],
  project: ['src/**/*.{ts,tsx,vue}'],
  ignoreBinaries: ['depcheck']
}

export default config
