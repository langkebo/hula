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
            // 约定：.test.ts 用于单元测试和契约测试（src/**/__tests__/、src/**/*.test.ts），
            //       .spec.ts 用于集成测试和 E2E 场景（tests/、e2e/）。
            //       两种模式均被 vitest 发现执行，无功能差异，仅命名约定区分用途。
            include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}', 'tests/lint/**/*.test.ts']
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
            setupFiles: ['./.storybook/setup-file.ts'],
            exclude: [
              'src/components/friend/FriendDetailDrawer.stories.ts',
              'src/components/friend/FriendListView.stories.ts',
              'src/components/friend/FriendRequestDialog.stories.ts',
              'src/components/friend/FriendListItem.stories.ts',
              'src/components/friend/FriendRequestCard.stories.ts',
              'src/components/rightBox/Details.stories.ts',
              'src/components/rightBox/chatBox/ChatSidebar.stories.ts',
              'src/components/room/RoomDetailPane.stories.ts',
              'src/components/workbench/RoomSessionList.stories.ts',
              'src/components/workbench/RoomSpaceWorkbench.stories.ts',
              'src/components/workbench/WorkbenchDetailPane.stories.ts',
              'src/components/workbench/HulaSpaceTree.stories.ts',
              'src/components/workbench/SpaceListPane.stories.ts',
              'src/components/rightBox/MsgInput.stories.ts',
              'src/components/rightBox/renderMessage/HulaMessageMeta.stories.ts'
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
