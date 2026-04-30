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

const child = spawn(process.execPath, [vitestEntrypoint, ...vitestArgs], {
  cwd: process.cwd(),
  env: process.env,
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
