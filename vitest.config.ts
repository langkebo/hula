/// <reference types="vitest" />

import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { storybookTest } from '@storybook/addon-vitest/vitest-plugin'
import { playwright } from '@vitest/browser-playwright'
import { defineConfig, mergeConfig } from 'vitest/config'
import { storybookMockAliases } from './.storybook/aliases.ts'
import { baseVitestConfig } from './build/config/vitest.config.base'

const dirname = typeof __dirname !== 'undefined' ? __dirname : path.dirname(fileURLToPath(import.meta.url))

export default defineConfig(
  mergeConfig(baseVitestConfig, {
    test: {
      projects: [
        {
          extends: true,
          test: {
            environment: 'happy-dom',
            globals: true,
            setupFiles: ['./tests/setup.ts'],
            include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}']
          }
        },
        {
          extends: true,
          plugins: [
            storybookTest({
              configDir: path.join(dirname, '.storybook')
            })
          ],
          optimizeDeps: {
            noDiscovery: true,
            exclude: ['matrix-js-sdk'],
            inline: ['colorthief']
          },
          resolve: {
            alias: storybookMockAliases
          },
          test: {
            name: 'storybook',
            exclude: [
              'src/components/friend/FriendDetailDrawer.stories.ts',
              'src/components/friend/FriendListView.stories.ts',
              'src/components/friend/FriendRequestDialog.stories.ts',
              'src/components/rightBox/Details.stories.ts',
              'src/components/rightBox/chatBox/ChatSidebar.stories.ts',
              'src/components/room/RoomDetailPane.stories.ts',
              'src/components/workbench/RoomSessionList.stories.ts',
              'src/components/workbench/RoomSpaceWorkbench.stories.ts',
              'src/components/workbench/WorkbenchDetailPane.stories.ts'
            ],
            browser: {
              enabled: true,
              headless: true,
              provider: playwright({}),
              instances: [
                {
                  browser: 'chromium'
                }
              ]
            }
          }
        }
      ]
    }
  })
)
