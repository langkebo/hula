/// <reference types="vitest" />

import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { storybookTest } from '@storybook/addon-vitest/vitest-plugin'
import { playwright } from '@vitest/browser-playwright'
import { defineConfig, mergeConfig } from 'vitest/config'
import { storybookMockAliases } from './.storybook/aliases.ts'
import { baseVitestConfig } from './build/config/vitest.config.base'

const dirname = typeof __dirname !== 'undefined' ? __dirname : path.dirname(fileURLToPath(import.meta.url))

const enableStorybook = process.env.STORYBOOK_TEST === '1'

const storybookProject = {
  extends: true,
  plugins: [
    storybookTest({
      configDir: path.join(dirname, '.storybook')
    })
  ],
  optimizeDeps: {
    // 不设 noDiscovery：让 Vite 通过 import 链自动发现 CJS 依赖
    // exclude matrix-js-sdk：避免其在浏览器中执行时 logger 访问 process.env 失败
    //   其传递依赖也不预打包——stories 通过 setup-file 的 vi.mock 截断 matrix-js-sdk 运行时导入
    // 显式 include aria-query：@testing-library/dom 依赖的 CJS 模块，必须预打包成 ESM
    //   否则浏览器直接以 ESM 加载 CJS 会报 "does not provide an export named 'elementRoles'"
    exclude: ['matrix-js-sdk'],
    include: ['aria-query', 'bs58', 'jwt-decode', 'oidc-client-ts', 'p-retry', 'uuid', 'zod'],
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
            include: [
              'src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
              'tests/unit/**/*.test.ts',
              'tests/lint/**/*.test.ts'
            ]
          }
        },
        // storybook 项目默认禁用：aria-query ESM 兼容性问题 + 并行运行拖慢 transform 资源
        // 启用方式：STORYBOOK_TEST=1 pnpm test:run
        ...(enableStorybook ? [storybookProject] : [])
      ]
    }
  })
)
