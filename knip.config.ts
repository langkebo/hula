import type { KnipConfig } from 'knip'

const config: KnipConfig = {
  ignore: ['src/types/matrix-js-sdk-augmentations.d.ts'],
  ignoreDependencies: ['matrix-js-sdk'],
  entry: ['src/main.ts', 'src/mobile/main.ts'],
  project: ['src/**/*.{ts,tsx,vue}'],
  ignoreBinaries: ['pnpm']
}

export default config
