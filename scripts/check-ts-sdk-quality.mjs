import { spawnSync } from 'node:child_process'

const TARGET_PREFIXES = [
  'src/services/matrix/',
  'src/utils/PerformanceReporter.ts',
  'src/utils/WebVitalsObserver.ts',
  'src/utils/__tests__/PerformanceReporter.test.ts'
]

const result = spawnSync(
  'pnpm',
  ['exec', 'vue-tsc', '--noEmit', '--pretty', 'false', '--noUnusedLocals', '--noUnusedParameters'],
  {
    cwd: process.cwd(),
    encoding: 'utf8'
  }
)

const combinedOutput = [result.stdout, result.stderr].filter(Boolean).join('\n')
const lines = combinedOutput.split(/\r?\n/)

const isTargetLine = (line) => TARGET_PREFIXES.some((prefix) => line.startsWith(prefix))

const filteredLines = []
let includeNextIndentedBlock = false

for (const line of lines) {
  if (isTargetLine(line)) {
    filteredLines.push(line)
    includeNextIndentedBlock = true
    continue
  }

  if (includeNextIndentedBlock && (line.startsWith(' ') || line.startsWith('\t') || line.trim() === '')) {
    filteredLines.push(line)
    continue
  }

  includeNextIndentedBlock = false
}

if (filteredLines.some((line) => isTargetLine(line))) {
  console.error(filteredLines.join('\n').trim())
  process.exit(1)
}

console.log('[check-ts-sdk-quality] 未发现 SDK 目标范围内的 unused TypeScript 诊断')
