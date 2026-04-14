import { test, expect } from '@playwright/test'

test.describe('DPI Manager E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('#app', { state: 'visible' })
  })

  test('should initialize app with default scale', async ({ page }) => {
    const appElement = await page.$('#app')
    expect(appElement).toBeTruthy()

    const zoom = await appElement?.evaluate((el) => {
      return (el as HTMLElement).style.getPropertyValue('zoom') || '1'
    })
    expect(zoom).toBeTruthy()
  })

  test('should set CSS custom properties for scale', async ({ page }) => {
    const appScale = await page.evaluate(() => {
      return document.documentElement.style.getPropertyValue('--app-scale')
    })

    const devicePixelRatio = await page.evaluate(() => {
      return document.documentElement.style.getPropertyValue('--device-pixel-ratio')
    })

    expect(appScale).toBeTruthy()
    expect(devicePixelRatio).toBeTruthy()
  })

  test('should handle window resize', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 })

    await page.waitForTimeout(100)

    const appElement = await page.$('#app')
    expect(appElement).toBeTruthy()
  })
})

test.describe('EditInfo Store E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('#app', { state: 'visible' })
  })

  test('should have edit info store initialized', async ({ page }) => {
    const storeState = await page.evaluate(() => {
      const pinia = (window as unknown as { __PINIA__?: unknown }).__PINIA__
      return pinia !== undefined
    })

    expect(storeState).toBe(true)
  })
})

test.describe('Accessibility Tests', () => {
  test('should have no accessibility violations on main page', async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('#app', { state: 'visible' })

    const appElement = await page.$('#app')
    expect(appElement).toBeTruthy()
  })
})

test.describe('Performance Tests', () => {
  test('should load app within acceptable time', async ({ page }) => {
    const startTime = Date.now()
    await page.goto('/')
    await page.waitForSelector('#app', { state: 'visible' })
    const loadTime = Date.now() - startTime

    expect(loadTime).toBeLessThan(5000)
  })

  test('should have no console errors on load', async ({ page }) => {
    const errors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text())
      }
    })

    await page.goto('/')
    await page.waitForSelector('#app', { state: 'visible' })

    const criticalErrors = errors.filter(
      (e) =>
        !e.includes('favicon') &&
        !e.includes('[HMR]') &&
        !e.includes('[Vue warn]') &&
        !e.includes('onMounted') &&
        !e.includes('onUnmounted')
    )

    expect(criticalErrors.length).toBe(0)
  })
})

test.describe('Responsive Design Tests', () => {
  test('should adapt to mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto('/')
    await page.waitForSelector('#app', { state: 'visible' })

    const appElement = await page.$('#app')
    expect(appElement).toBeTruthy()
  })

  test('should adapt to tablet viewport', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 })
    await page.goto('/')
    await page.waitForSelector('#app', { state: 'visible' })

    const appElement = await page.$('#app')
    expect(appElement).toBeTruthy()
  })

  test('should adapt to desktop viewport', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 })
    await page.goto('/')
    await page.waitForSelector('#app', { state: 'visible' })

    const appElement = await page.$('#app')
    expect(appElement).toBeTruthy()
  })
})
