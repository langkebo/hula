import { execSync } from 'node:child_process'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const scriptPath = resolve(process.cwd(), 'scripts/check-sdk-augmentations.mjs')

/**
 * Smoke test for the SDK augmentation drift checker. The script depends on
 * the sibling `../matrix-js-sdk` repo being present, which it is in this
 * dev environment. We don't assert a pass/fail result (the augmentation
 * has known pending drift that will be cleaned up in a later step) — we
 * only assert the script runs and emits well-formed JSON.
 */
describe('check-sdk-augmentations', () => {
  it('emits JSON with expected top-level shape', () => {
    let output = ''
    let exitCode = 0
    try {
      output = execSync(`node ${scriptPath} --json`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
    } catch (err) {
      // exit code 1 is expected when drifts are present
      const e = err as { stdout?: Buffer | string; status?: number }
      output = e.stdout?.toString() ?? ''
      exitCode = e.status ?? 0
    }
    expect([0, 1]).toContain(exitCode)
    const report = JSON.parse(output)
    expect(report).toMatchObject({
      augmentedEnumCount: expect.any(Number),
      canonicalEnumCount: expect.any(Number),
      errors: expect.any(Array),
      warnings: expect.any(Array)
    })
    expect(report.augmentedEnumCount).toBeGreaterThan(0)
    expect(report.canonicalEnumCount).toBeGreaterThan(0)
  }, 30_000)

  it('reports drift finding shape with type + enum + detail fields', () => {
    let output = ''
    try {
      output = execSync(`node ${scriptPath} --json`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
    } catch (err) {
      const e = err as { stdout?: Buffer | string }
      output = e.stdout?.toString() ?? ''
    }
    const report = JSON.parse(output)
    const allFindings = [...report.errors, ...report.warnings]
    for (const f of allFindings) {
      expect(f).toMatchObject({
        type: expect.stringMatching(
          /^(extra-in-augmentation|missing-in-augmentation|value-mismatch|missing-canonical)$/
        ),
        enum: expect.any(String),
        detail: expect.any(String)
      })
    }
  }, 60_000)
})
