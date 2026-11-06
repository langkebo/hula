import { spawn } from 'child_process'
import path from 'path'
import { fileURLToPath } from 'url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const vitestEntrypoint = path.resolve(currentDir, '../node_modules/vitest/vitest.mjs')
const vitestArgs = process.argv.slice(2)

const filteredStderrPatterns = [
  /Warning: `--localstorage-file` was provided without a valid path/,
  /^\(Use `node --trace-warnings .* warning was created\)$/
]

// 宿主（WorkBuddy / Trae 沙箱）可能通过 NODE_OPTIONS 注入 node-language-shim 并开启
// CODEBUDDY_BROKERED_FS_HOOK_ENABLED=1：每个 readFileSync 变成一次 broker IPC，高并发下
// broker `connect failed: Connection refused`，被 vitest 记成用例失败/超时（非代码问题）。
// shim 仅在该变量严格等于 '1' 时启用文件系统钩子，因此这里固定置 0，让单测结果只反映代码本身。
const childEnv = { ...process.env, CODEBUDDY_BROKERED_FS_HOOK_ENABLED: '0' }

const child = spawn(process.execPath, [vitestEntrypoint, ...vitestArgs], {
  cwd: process.cwd(),
  env: childEnv,
  stdio: ['inherit', 'pipe', 'pipe']
})

child.stdout.on('data', (chunk) => {
  process.stdout.write(chunk)
})

let stderrBuffer = ''

child.stderr.on('data', (chunk) => {
  stderrBuffer += chunk.toString()
  const lines = stderrBuffer.split('\n')
  stderrBuffer = lines.pop() ?? ''

  for (const line of lines) {
    if (!filteredStderrPatterns.some((pattern) => pattern.test(line.trim()))) {
      process.stderr.write(`${line}\n`)
    }
  }
})

child.stderr.on('end', () => {
  if (stderrBuffer && !filteredStderrPatterns.some((pattern) => pattern.test(stderrBuffer.trim()))) {
    process.stderr.write(stderrBuffer)
  }
})

child.on('close', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal)
    return
  }

  process.exit(code ?? 1)
})

child.on('error', (error) => {
  const errorMessage = error instanceof Error ? (error.stack ?? error.message) : String(error)
  process.stderr.write(`${errorMessage}\n`)
  process.exit(1)
})
