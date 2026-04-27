import { expect, test, type Page } from '@playwright/test'

type RenderSample = {
  name: string
  duration: number
  thresholdMs: number
  route: string
  status: 'pass' | 'warn'
}

type RuntimeIssueCollector = {
  componentResolveErrors: string[]
  lazyLoadErrors: string[]
}

const bootstrapDesktopHarness = async (page: Page) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('hula:e2e:enabled', '1')
    window.localStorage.setItem('hula:e2e:mock-auth', '1')
    window.localStorage.setItem('hula:e2e:platform', 'desktop')
    ;(window as Window & { __HULA_RENDER_SAMPLES__?: RenderSample[] }).__HULA_RENDER_SAMPLES__ = []
  })
}

const createRuntimeIssueCollector = (page: Page): RuntimeIssueCollector => {
  const collector: RuntimeIssueCollector = {
    componentResolveErrors: [],
    lazyLoadErrors: []
  }

  page.on('console', (message) => {
    const text = message.text()
    if (text.includes('Failed to resolve component')) {
      collector.componentResolveErrors.push(text)
    }
    if (
      /Failed to fetch dynamically imported module|ChunkLoadError|error loading dynamically imported module/i.test(text)
    ) {
      collector.lazyLoadErrors.push(text)
    }
  })

  page.on('pageerror', (error) => {
    const text = String(error)
    if (
      /Failed to fetch dynamically imported module|ChunkLoadError|error loading dynamically imported module/i.test(text)
    ) {
      collector.lazyLoadErrors.push(text)
    }
  })

  return collector
}

const expectNoRouteRuntimeIssues = (collector: RuntimeIssueCollector) => {
  expect(collector.componentResolveErrors, '页面不应出现桌面端组件解析失败').toEqual([])
  expect(collector.lazyLoadErrors, '页面不应出现懒加载 chunk 拉取失败').toEqual([])
}

const waitForSample = async (page: Page, name: string): Promise<RenderSample> => {
  await page.waitForFunction((sampleName) => {
    const samples = (window as Window & { __HULA_RENDER_SAMPLES__?: RenderSample[] }).__HULA_RENDER_SAMPLES__
    return Boolean(samples?.some((sample) => sample.name === sampleName))
  }, name)

  const sample = await page.evaluate((sampleName) => {
    const samples = (window as Window & { __HULA_RENDER_SAMPLES__?: RenderSample[] }).__HULA_RENDER_SAMPLES__
    return samples?.find((item) => item.name === sampleName) ?? null
  }, name)

  expect(sample).toBeTruthy()
  return sample as RenderSample
}

test.describe('Desktop Key Flows', () => {
  test.beforeEach(async ({ page }) => {
    test.skip(test.info().project.name !== 'desktop-chromium', '桌面关键路径仅在桌面项目下运行')
    await bootstrapDesktopHarness(page)
  })

  test('redirects legacy desktop settings routes to canonical tabs', async ({ page }) => {
    const runtimeIssues = createRuntimeIssueCollector(page)

    await page.goto('/notification')
    await expect(page).toHaveURL(/\/settings\?tab=notifications$/)
    await expect(page.locator('#settings-tab-notifications')).toHaveAttribute('aria-selected', 'true')

    await page.goto('/shortcut')
    await expect(page).toHaveURL(/\/settings\?tab=keyboard$/)
    await expect(page.locator('#settings-tab-keyboard')).toHaveAttribute('aria-selected', 'true')

    await page.goto('/security-privacy')
    await expect(page).toHaveURL(/\/settings\?tab=securityPrivacy$/)
    await expect(page.locator('#settings-tab-securityPrivacy')).toHaveAttribute('aria-selected', 'true')

    expectNoRouteRuntimeIssues(runtimeIssues)
  })

  test('supports desktop settings navigation and search', async ({ page }) => {
    const runtimeIssues = createRuntimeIssueCollector(page)

    await page.goto('/settings?tab=preferences')
    await page.waitForLoadState('networkidle')

    await expect(page).toHaveURL(/\/settings\?tab=preferences$/)
    await expect(page.locator('#settings-tab-preferences')).toHaveAttribute('aria-selected', 'true')
    await expect(page.locator('#settings-tab-panel')).toBeVisible()

    const searchInput = page.locator('.settings-search input')
    await expect(searchInput).toBeVisible()
    await searchInput.fill('voice')

    await expect(page.locator('#settings-tab-voiceVideo')).toBeVisible()
    await expect(page.locator('#settings-tab-account')).toHaveCount(0)

    await searchInput.clear()
    await expect(page.locator('#settings-tab-account')).toBeVisible()

    await page.locator('#settings-tab-notifications').click()
    await expect(page.locator('#settings-tab-notifications')).toHaveAttribute('aria-selected', 'true')
    await expect(page.locator('#settings-tab-preferences')).toHaveAttribute('aria-selected', 'false')

    expectNoRouteRuntimeIssues(runtimeIssues)
  })

  test('collects desktop dynamic render samples under 800ms', async ({ page }, testInfo) => {
    const runtimeIssues = createRuntimeIssueCollector(page)

    await page.goto('/dynamic')
    await page.waitForLoadState('networkidle')

    await expect(page).toHaveURL(/\/dynamic$/)
    await expect(page.getByRole('heading', { name: '动态共享骨架已接入' })).toBeVisible()

    const indexSample = await waitForSample(page, 'desktop-dynamic-index')
    expect(indexSample.duration).toBeLessThan(indexSample.thresholdMs)

    await page.goto('/dynamic/detail')
    await page.waitForLoadState('networkidle')

    await expect(page).toHaveURL(/\/dynamic\/detail$/)
    await expect(page.getByRole('heading', { name: '动态详情' })).toBeVisible()

    const detailSample = await waitForSample(page, 'desktop-dynamic-detail')
    expect(detailSample.duration).toBeLessThan(detailSample.thresholdMs)
    expectNoRouteRuntimeIssues(runtimeIssues)

    await testInfo.attach('desktop-dynamic-render-samples.json', {
      body: JSON.stringify([indexSample, detailSample], null, 2),
      contentType: 'application/json'
    })
  })
})
