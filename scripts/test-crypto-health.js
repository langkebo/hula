#!/usr/bin/env node
/**
 * CryptoHealthMonitor 专项测试
 *
 * 针对加密健康监控模块的边界条件、降级策略、回调机制进行覆盖测试。
 * 由 CI quality-gate 调用，失败即阻塞流水线。
 */

import { spawn } from 'child_process'
import path from 'path'
import { fileURLToPath } from 'url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const vitestEntrypoint = path.resolve(currentDir, '../node_modules/vitest/vitest.mjs')
const testPath = path.resolve(currentDir, '../src/services/matrix/crypto/__tests__/CryptoHealthMonitor.test.ts')

const child = spawn(process.execPath, [vitestEntrypoint, 'run', testPath, '--reporter=verbose'], {
  cwd: process.cwd(),
  env: { ...process.env, CI: 'true' },
  stdio: 'inherit'
})

child.on('close', (code) => process.exit(code ?? 1))
