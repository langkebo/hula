/**
 * 路由集: desktop
 * 依据：账号内页（`/message`、`/friend`、`/space`、`/federation`、`/search`）只在桌面路由集装配；
 *       移动端有自己的 `/mobile/*` 壳与对比度基线（见 `a11y-baseline.spec.ts` 的 A11Y-M）。
 * 校验：`tests/lint/e2e-route-sets.test.ts`（与 `e2e/specRouteSets.ts` 名单逐条比对）。
 *
 * 账号内页对比度取证（报告 §13.11 第 3 项）：同一套真实登录态页面，
 * 分别切 light / dark 两轮，只跑 axe 的 `color-contrast` 规则（serious 级）。
 *
 * 为什么只跑 color-contrast：其余 a11y 规则已在 `a11y-baseline.spec.ts` 的未登录壳上守门，
 * 这里要回答的是「登录后内容区在双主题下文字对比度是否达标」。
 */
import { expect, test } from '@playwright/test'
import {
  buildLiveEnv,
  getLiveAccountSkipReason,
  readLiveAppUrl,
  readLiveHomeserverUrl,
  registerLiveAccount
} from './support/liveAccount'
import { bootstrapMatrixLivePage, loginToMatrixLive } from './support/matrixLive'

type AxeViolation = {
  id: string
  impact?: string | null
  nodes: Array<{ target: string[]; html?: string; failureSummary?: string }>
}
type AxeRun = (ctx: unknown, opts: unknown) => Promise<{ violations: AxeViolation[] }>

const A11Y_ROUTES = ['/message', '/friend', '/space', '/federation', '/search'] as const
const SETTING_STORE_PATH = '/src/stores/domains/settings/setting.ts'
const ROUTER_MODULE_PATH = '/src/router/index.ts'

const resolveDesktopAppUrl = (): string => readLiveAppUrl(test.info().project.use.baseURL ?? undefined)

const loadAxeSource = async (): Promise<string | null> => {
  try {
    const mod = (await import('axe-core')) as unknown as { source?: string; default?: { source?: string } }
    return mod?.source ?? mod?.default?.source ?? null
  } catch {
    return null
  }
}

const runColorContrast = (page: import('@playwright/test').Page): Promise<AxeViolation[]> =>
  page.evaluate(async () => {
    const axe = (window as unknown as { axe?: { run: AxeRun } }).axe
    if (!axe) return []
    const result = await axe.run(
      { exclude: ['.n-avatar'] },
      { runOnly: { type: 'rule', values: ['color-contrast'] }, resultTypes: ['violations'] }
    )
    return result.violations as AxeViolation[]
  })

const pushRoute = async (page: import('@playwright/test').Page, path: string): Promise<void> => {
  await page.evaluate(
    async ({ routerPath, target }: { routerPath: string; target: string }) => {
      const routerModule = (await import(/* @vite-ignore */ routerPath)) as {
        default: { push: (location: string) => Promise<unknown> }
      }
      await routerModule.default.push(target)
    },
    { routerPath: ROUTER_MODULE_PATH, target: path }
  )
}

/**
 * 走应用真实主题切换（setting store），不能只改 `html[data-theme]`：
 * Naive UI 的暗色主题由 `settingStore.themeContent` 驱动 NConfigProvider，
 * 只翻 DOM 属性会出现「UnoCSS token 已变暗、Naive 仍是亮色文字」的假暗色态。
 */
const setTheme = async (page: import('@playwright/test').Page, theme: 'light' | 'dark'): Promise<void> => {
  await page.evaluate(
    async ({ storePath, nextTheme }: { storePath: string; nextTheme: string }) => {
      const module = (await import(/* @vite-ignore */ storePath)) as {
        useSettingStore: () => { toggleTheme: (next: string) => void }
      }
      module.useSettingStore().toggleTheme(nextTheme)
    },
    { storePath: SETTING_STORE_PATH, nextTheme: theme }
  )
  await expect
    .poll(() => page.evaluate(() => document.documentElement.getAttribute('data-theme')), {
      timeout: 10_000,
      message: `主题应切换到 ${theme}`
    })
    .toBe(theme)
  await page.waitForTimeout(400)
}

const describeViolation = (violation: AxeViolation): string => {
  const node = violation.nodes[0]
  const summary = (node?.failureSummary ?? '').split('\n').filter(Boolean).slice(-2).join(' ')
  return `${violation.id} @ ${node?.target.join(' > ') ?? 'n/a'} :: ${(node?.html ?? '').slice(0, 160)}${summary ? ` [${summary}]` : ''}`
}

test.describe('账号内页双主题对比度（真后端）', () => {
  test.beforeEach(() => {
    test.skip(test.info().project.name !== 'desktop-chromium', '账号内页只在桌面路由集装配')
    const skipReason = getLiveAccountSkipReason()
    test.skip(Boolean(skipReason), skipReason ?? '')
  })

  test('light/dark 两轮 color-contrast 无 serious 违规 @a11y', async ({ page }) => {
    test.setTimeout(240_000)
    const axeSource = await loadAxeSource()
    test.skip(!axeSource, 'axe-core 未安装，跳过对比度取证')
    await page.addInitScript({ content: axeSource })

    const homeserverUrl = readLiveHomeserverUrl()
    const account = await registerLiveAccount(homeserverUrl, { prefix: 'e2ea11y' })
    const env = buildLiveEnv({ account, appUrl: resolveDesktopAppUrl(), homeserverUrl })
    await bootstrapMatrixLivePage(page, env)
    await loginToMatrixLive(page, env)

    const failures: string[] = []

    for (const theme of ['light', 'dark'] as const) {
      await setTheme(page, theme)
      for (const route of A11Y_ROUTES) {
        await pushRoute(page, route)
        await expect
          .poll(() => new URL(page.url()).pathname, { timeout: 15_000, message: `${route} 路由应命中` })
          .toBe(route)
        await page.waitForTimeout(800)
        const violations = (await runColorContrast(page)).filter(
          (violation) => violation.impact === 'serious' || violation.impact === 'critical'
        )
        for (const violation of violations) {
          failures.push(`[${theme}] ${route} -> ${describeViolation(violation)}`)
        }
      }
    }

    await setTheme(page, 'light')

    expect(failures, `账号内页对比度违规：\n${failures.join('\n')}`).toHaveLength(0)
  })
})
