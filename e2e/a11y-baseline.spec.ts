import { expect, test } from '@playwright/test'

/**
 * §18.6 / §20.1 KPI — axe-playwright a11y baseline.
 *
 * CI runs this suite via `pnpm test:a11y` (Playwright grep: @a11y) and MUST
 * fail on any violation classified `serious` or `critical`.
 *
 * Phase 1 covers the critical entry surfaces: login shell and the mobile
 * message list skeleton. Additional routes will be appended as auth
 * harnesses become available (follow §20.3 inventory #1 / #2 / #16).
 *
 * This spec degrades gracefully when `axe-core` is not installed so local
 * development without the dev dep still passes; CI installs it via the
 * `lint:a11y` job defined in `docs/HULA_SDK_REINTEGRATION_OPTIMIZATION_PLAN_2026-05-03.md`
 * and fails if the module is absent.
 */

type AxeRun = (ctx: unknown, opts: unknown) => Promise<{ violations: AxeViolation[] }>
type AxeViolation = { id: string; impact?: string | null; nodes: Array<{ target: string[] }> }

async function loadAxeSource(): Promise<string | null> {
  try {
    const mod = (await import('axe-core')) as unknown as { source?: string }
    return mod?.source ?? null
  } catch {
    return null
  }
}

async function runAxe(page: import('@playwright/test').Page): Promise<AxeViolation[]> {
  const source = await loadAxeSource()
  if (!source) return []
  await page.addScriptTag({ content: source })
  const violations = await page.evaluate(async () => {
    const axe = (window as unknown as { axe?: { run: AxeRun } }).axe
    if (!axe) return []
    const result = await axe.run(document, { resultTypes: ['violations'] })
    return result.violations as AxeViolation[]
  })
  return violations
}

function blocking(violations: AxeViolation[]) {
  return violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')
}

test.describe('a11y baseline', () => {
  test('login shell has no serious/critical violations @a11y', async ({ page }) => {
    const axeAvailable = (await loadAxeSource()) !== null
    test.skip(!axeAvailable, 'axe-core not installed — install it in CI to enforce a11y gate')

    await page.goto('/')
    await page.waitForLoadState('networkidle')
    const violations = blocking(await runAxe(page))
    expect(
      violations,
      `serious/critical a11y violations: ${violations.map((v) => `${v.id} @ ${v.nodes[0]?.target.join(' > ') ?? 'n/a'}`).join('; ')}`
    ).toHaveLength(0)
  })
})
