import type { StorybookConfig } from '@storybook/vue3-vite'
import { mergeConfig } from 'vite'
import { storybookMockAliases } from './aliases.ts'

const config: StorybookConfig = {
  stories: ['../src/**/*.stories.@(js|jsx|mjs|ts|tsx)'],
  refs: {
    '@vueuse/components': {
      disable: true
    },
    '@vueuse/core': {
      disable: true
    }
  },
  // 仅保留 a11y：CI 的 `pnpm check:a11y` 依赖该 addon 扫描全量 story；
  // onboarding / docs / vitest 三个 addon 在本项目无产出消费方，已移除。
  addons: ['@storybook/addon-a11y'],
  framework: '@storybook/vue3-vite',
  async viteFinal(baseConfig) {
    return mergeConfig(baseConfig, {
      resolve: {
        alias: storybookMockAliases
      }
    })
  }
}

export default config
