#!/usr/bin/env node
import { execSync } from 'node:child_process'

const steps = [
  { name: 'Lint', cmd: 'pnpm check:ci' },
  { name: 'Type Check', cmd: 'pnpm exec vue-tsc --noEmit' },
  { name: 'Unit Tests', cmd: 'pnpm test:run' },
]

let failed = false
for (const step of steps) {
  console.log(`\n--- ${step.name} ---`)
  try {
    execSync(step.cmd, { stdio: 'inherit', cwd: import.meta.dirname + '/..' })
    console.log(`${step.name}: PASS`)
  } catch {
    console.error(`${step.name}: FAIL`)
    failed = true
  }
}

if (failed) {
  console.error('\nRelease gate FAILED')
  process.exit(1)
}
console.log('\nRelease gate PASSED')
