/**
 * Guard Pattern Checker — 防止手写单次执行守卫被重新引入
 *
 * 检查 service/util 文件中是否存在手写的幂等/并发去重字段，
 * 这些字段应使用 @/utils/ExecutionGuard 的 SingleFlight / IdempotencyGuard 替代。
 *
 * 检测模式：
 * - inflightPromise / inFlightPromise — 应使用 SingleFlight
 * - bootstrapSettled / bootstrapPromise — 应使用 IdempotencyGuard
 * - clientStarted / hasStarted — 应使用 IdempotencyGuard
 *
 * 允许清单：ExecutionGuard.ts 本身 + 同步函数中合理的布尔标志（永久例外）
 */
import { execSync } from 'node:child_process'

const ALLOWLIST = new Set([
  'src/utils/ExecutionGuard.ts', // the utility itself
  // 永久例外：WebVitalsObserver.startWebVitalObserver 是同步函数，
  // hasStarted 布尔标志是同步幂等的正确最小模式。
  // IdempotencyGuard 针对 async 并发去重，强制包装会过度工程化。
  'src/utils/WebVitalsObserver.ts'
])

const PATTERNS = [
  'inflightPromise',
  'inFlightPromise',
  'bootstrapSettled',
  'bootstrapPromise',
  'clientStarted',
  'hasStarted'
]

const patternRegex = PATTERNS.map((p) => `\\b${p}\\b`).join('|')

let output = ''
try {
  output = execSync(
    `grep -rlnE '${patternRegex}' src/ --include='*.ts' --include='*.tsx'`,
    { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }
  )
} catch (err) {
  // grep exit code 1 = no matches, which is fine
  if (err.status !== 1) {
    throw err
  }
}

const files = output.trim().split('\n').filter(Boolean)
const nonTestFiles = files.filter((f) => !f.includes('__tests__') && !f.endsWith('.test.ts') && !f.endsWith('.spec.ts'))
const violations = nonTestFiles.filter((f) => !ALLOWLIST.has(f))

if (violations.length > 0) {
  console.error(`ERROR: ${violations.length} file(s) use hand-written guard patterns (inflightPromise/bootstrapSettled/clientStarted/hasStarted):`)
  violations.forEach((f) => console.error(`  ${f}`))
  console.error('')
  console.error('Use SingleFlight / IdempotencyGuard from @/utils/ExecutionGuard instead.')
  console.error('If migration is not yet possible, add the file to the allowlist in scripts/check-guard-patterns.mjs with a TODO comment.')
  process.exit(1)
}

console.log(`OK: No hand-written guard patterns found outside allowlist (${ALLOWLIST.size} file(s) allowed)`)
