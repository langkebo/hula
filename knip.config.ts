import type { KnipConfig } from 'knip'

const config: KnipConfig = {
  ignore: [
    // Storybook mocks are referenced via Vite resolve.alias in .storybook/aliases.ts,
    // not via static imports — knip cannot trace them.
    '.storybook/mocks/**',
    // vitest setupFiles 由 vitest.config.ts 引用，knip 无对应插件无法追踪。
    '.storybook/setup-file.ts'
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
    // 绑定关系与维护规则见 docs/baseline/dependency-vendor-runtime.md，
    // 并由 scripts/check-vendor-runtime-deps.mjs 守卫。
    'content-type',
    'events',
    'loglevel',
    'matrix-events-sdk',
    'matrix-widget-api',
    'sdp-transform',
    // UnoCSS 虚拟模块（由 @unocss/vite 在构建期提供）
    'uno.css'
  ],
  ignoreBinaries: ['adb', 'python3'],
  // e2e 用例经 `/* @vite-ignore */` 动态 import 的 Vite dev-server 绝对路径
  // （运行时才解析，静态不可追踪）。传真正的 RegExp 字面量，避免被 knip 当作
  // 字符串再 new RegExp 导致 "Nothing to repeat" 崩溃。
  ignoreUnresolved: [/^\/src\//]
}

export default config
