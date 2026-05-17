import type { StorybookConfig } from '@storybook/vue3-vite'
import { mergeConfig } from 'vite'
import { storybookMockAliases } from './aliases.ts'

const config: StorybookConfig = {
  stories: ['../src/**/*.mdx', '../src/**/*.stories.@(js|jsx|mjs|ts|tsx)'],
  refs: {
    '@vueuse/components': {
      disable: true
    },
    '@vueuse/core': {
      disable: true
    }
  },
  addons: ['@storybook/addon-vitest', '@storybook/addon-a11y', '@storybook/addon-docs', '@storybook/addon-onboarding'],
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
