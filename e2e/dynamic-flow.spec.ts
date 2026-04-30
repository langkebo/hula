import { expect, type Page, test } from '@playwright/test'

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

const bootstrapMobileHarness = async (page: Page) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('hula:e2e:enabled', '1')
    window.localStorage.setItem('hula:e2e:mock-auth', '1')
    window.localStorage.setItem('hula:e2e:platform', 'mobile')
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
  expect(collector.componentResolveErrors, '页面不应出现移动端组件解析失败').toEqual([])
  expect(collector.lazyLoadErrors, '页面不应出现懒加载 chunk 拉取失败').toEqual([])
}

const resetSamples = async (page: Page) => {
  await page.evaluate(() => {
    ;(window as Window & { __HULA_RENDER_SAMPLES__?: RenderSample[] }).__HULA_RENDER_SAMPLES__ = []
  })
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

test.describe('Dynamic Mobile Flow', () => {
  test('collects Dynamic navigation render samples under 800ms', async ({ page }, testInfo) => {
    test.skip(!test.info().project.name.startsWith('mobile-'), 'Dynamic 移动导航流仅在移动项目下运行')

    const runtimeIssues = createRuntimeIssueCollector(page)
    await bootstrapMobileHarness(page)
    await page.goto('/mobile/dynamic')
    await page.waitForLoadState('networkidle')

    await expect(page).toHaveURL(/\/mobile\/dynamic$/)
    await expect(page.getByText('动态共享骨架')).toBeVisible({ timeout: 10000 })

    const indexSample = await waitForSample(page, 'mobile-dynamic-index')
    expectNoRouteRuntimeIssues(runtimeIssues)
    expect(indexSample.duration).toBeLessThan(indexSample.thresholdMs)

    await resetSamples(page)
    await page.getByTestId('dynamic-card-detail').evaluate((node: HTMLElement) => {
      node.click()
    })

    await expect(page).toHaveURL(/\/mobile\/dynamic\/[^/]+$/)
    await expect(page.getByText('动态详情').first()).toBeVisible()

    const detailSample = await waitForSample(page, 'mobile-dynamic-detail')
    expectNoRouteRuntimeIssues(runtimeIssues)
    expect(detailSample.duration).toBeLessThan(detailSample.thresholdMs)

    await testInfo.attach('dynamic-render-samples.json', {
      body: JSON.stringify([indexSample, detailSample], null, 2),
      contentType: 'application/json'
    })
  })
})
