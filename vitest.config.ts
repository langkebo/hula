/// <reference types="vitest" />

import { defineConfig, mergeConfig } from 'vitest/config'
import { baseVitestConfig } from './build/config/vitest.config.base'

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
            // 超时策略（2026-10-11 初定 60s；2026-10-12 P2-4 收敛到 30s，对齐审查报告 TS-04）：
            // 本套件每个测试文件都要付一次较重的环境构建代价（Vue 插件 + naive-ui + 自动导入），
            // 另有相当一批用例用动态 `await import()` 拉入重型模块（其 transform 成本随并行度放大）。
            // 默认值用于覆盖「绝大多数用例」；个别确实更慢的用例必须**自带**更长的 timeout，
            // 以便默认值保持为一个有意义的护栏（避免掩盖慢测试/死锁），当前两类显式放宽：
            //   ① 「扫描全仓」类结构守卫（presenceSingleWriter / css-naming-lint / design-tokens /
            //      dead-constants），见各文件顶部的 vi.setConfig（30–120s）；
            //   ② 重型移动端组件挂载（src/mobile/views/chat-room/__tests__/**，用例自带 240s timeout）。
            //      注意：它们「慢」的主因不是用例逻辑（子组件已全部 stub），而是在 WorkBuddy 沙箱里
            //      `NODE_OPTIONS=--require node-language-shim.cjs` + `CODEBUDDY_BROKERED_FS_HOOK_ENABLED=1`
            //      把每个 readFileSync 变成一次 broker IPC：同一批用例 90s vs 6s（差 14×），
            //      负载高时 broker 还会 `connect failed: Connection refused` ⇒ 报成失败而非超时。
            //      批量跑若出现这类红，先关钩子重跑（`scripts/run-vitest.js` 已统一固定
            //      `CODEBUDDY_BROKERED_FS_HOOK_ENABLED=0`，走该脚本无需手工加前缀）
            //      240s 只是沙箱下的余量，不是根因修复。
            // 详见审计报告 §12.2 / §13。
            testTimeout: 30_000,
            // 约定：.test.ts 用于单元测试和契约测试（src/**/__tests__/、src/**/*.test.ts），
            //       .spec.ts 用于集成测试和 E2E 场景（tests/、e2e/）。
            //       两种模式均被 vitest 发现执行，无功能差异，仅命名约定区分用途。
            include: [
              'src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
              'tests/unit/**/*.test.ts',
              'tests/lint/**/*.test.ts'
            ]
          }
        }
      ]
    }
  })
)
