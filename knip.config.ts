import type { KnipConfig } from 'knip'

const config: KnipConfig = {
  ignore: [
    // Storybook mocks are referenced via Vite resolve.alias in .storybook/aliases.ts,
    // not via static imports — knip cannot trace them.
    '.storybook/mocks/**',
    // 已知无用文件基线（P2-3 / 冗余清理专题核实后删除）。
    // 保留在此以免新引入的死文件被淹没，同时不放行新增项。
    '.storybook/setup-file.ts',
    'src/components/atomic/index.ts',
    'src/services/backend/ConfigService.ts',
    'src/stores/domains/chat/index.ts'
  ],
  entry: [
    // uno.config.ts 由 @unocss/vite 在构建期读取，knip 无对应插件需显式声明为入口；
    // vite/vitest/playwright/release-it 配置已被 knip 内置插件自动识别，无需重复声明。
    'uno.config.ts',
    // Vite 构建配置（plugin/optimizeDeps 聚合在此）
    'build/**/*.ts',
    // Storybook entries (suppresses false "unused" reports for .storybook/mocks/*)
    '.storybook/harness.ts',
    '.storybook/mock-data.ts',
    '.storybook/perf.ts'
  ],
  project: ['src/**/*.{ts,tsx,vue}', 'build/**/*.ts'],
  ignoreDependencies: [
    // matrix-js-sdk 源码（tarball）直接值导入的 CJS 小包。它们不在我们源码里被直接
    // import，但必须保留以配合 vite optimizeDeps.include（详见
    // build/config/vite.config.base.ts 的 2026-08-09 白屏事故注释），故作为基线忽略。
    'content-type',
    'events',
    'loglevel',
    'matrix-events-sdk',
    'matrix-widget-api',
    'sdp-transform',
    // release-it 运行时插件，尚未在 devDependencies 声明（P2-3 补声明）
    '@release-it/bumper',
    '@release-it/conventional-changelog',
    // UnoCSS 虚拟模块（由 @unocss/vite 在构建期提供）
    'uno.css',
    // 待 P2-3 核实删除：uuid 包已不在依赖中，@types/uuid 为孤儿声明
    '@types/uuid'
  ],
  ignoreBinaries: ['depcheck', 'adb', 'python3'],
  // e2e 用例经 `/* @vite-ignore */` 动态 import 的 Vite dev-server 绝对路径
  // （运行时才解析，静态不可追踪）。传真正的 RegExp 字面量，避免被 knip 当作
  // 字符串再 new RegExp 导致 "Nothing to repeat" 崩溃。
  ignoreUnresolved: [/^\/src\//]
}

export default config
