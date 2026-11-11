import { mkdirSync, writeFileSync } from 'node:fs'
import { expect, test } from '@playwright/test'
import { loginOnMobileUi } from './support/androidDevice'
import { autoDismissLocalUnlockGate, dismissLocalUnlockDialog } from './support/localUnlockGate'
import { MOBILE_APP_URL, pushMobileRoute, registerMobileAccount, seedE2EStorage } from './support/mobileHub'

/**
 * 「我的」页体验基线采集（方案 §十 的指标落地）。
 *
 * 为什么单独一条：S1–S3 已经把入口/搜索/外观都改过，但 G5（触控合规）、G6（首屏 TTI）、
 * 单手可达率三项一直只有目标值没有实测值 —— 没有基线就说不出"优化了多少"。
 *
 * 判据都写死在这里，避免各人口径不同：
 * - **触控合规**：`min(width, height) >= 44`（iOS HIG 44pt / Material 48dp 的常用下限）
 * - **单手可达**：元素中心落在视口 **下 60%**（centerYRatio >= 0.4）
 * - **首屏可交互（TTI）**：整页 reload → `「我的」九宫格可见` 的墙钟毫秒
 *
 * 默认不跑：`TJG_METRICS=1` 开启（它会 reload 页面，与功能断言用例的假设不同）。
 */

const SKIP_REASON = process.env.TJG_METRICS ? null : '未设置 TJG_METRICS（这是采集脚本，不是回归用例）'
const OUTPUT_PATH = 'test-results/mobile-metrics.json'

/** 可点元素扫描：只统计视口内、可见、有尺寸的 */
const SCAN_TOUCH_TARGETS = () => {
  const selector = 'button, a[href], [role="button"], .van-cell, .van-radio, .van-switch, .m-quick-item'
  const items = Array.from(document.querySelectorAll(selector)).filter((el) => {
    const rect = el.getBoundingClientRect()
    if (rect.width === 0 || rect.height === 0) return false
    if (rect.bottom < 0 || rect.top > window.innerHeight) return false
    const style = window.getComputedStyle(el)
    return style.visibility !== 'hidden' && style.display !== 'none'
  })

  /**
   * 有效热区：把 `::after/::before` 的负 inset 算进来。
   *
   * 顶栏图标就是 32×32 视觉盒 + `after:-inset-8px`（= 48×48 命中区）。
   * 只看盒子会把这类实现误判成不合规 —— 采集器口径必须先对齐实现手法。
   */
  const effectiveBox = (el: Element) => {
    const rect = el.getBoundingClientRect()
    let top = rect.top
    let left = rect.left
    let bottom = rect.bottom
    let right = rect.right
    for (const pseudo of ['::after', '::before'] as const) {
      const style = window.getComputedStyle(el, pseudo)
      if (style.content === 'none' || style.position !== 'absolute') continue
      const px = (value: string) => (value.endsWith('px') ? Number.parseFloat(value) : Number.NaN)
      const t = px(style.top)
      const b = px(style.bottom)
      const l = px(style.left)
      const r = px(style.right)
      if ([t, b, l, r].some((n) => !Number.isFinite(n))) continue
      if (t < 0) top += t
      if (l < 0) left += l
      if (b < 0) bottom -= b
      if (r < 0) right -= r
    }
    return { w: Math.round(right - left), h: Math.round(bottom - top) }
  }

  const measured = items.map((el) => {
    const box = effectiveBox(el)
    return {
      tag: el.tagName.toLowerCase(),
      cls: String(el.className ?? '')
        .split(/\s+/)
        .slice(0, 2)
        .join('.'),
      text: (el.textContent ?? '').trim().slice(0, 18),
      w: box.w,
      h: box.h
    }
  })

  const offenders = measured.filter((m) => Math.min(m.w, m.h) < 44)
  return {
    total: measured.length,
    compliant: measured.length - offenders.length,
    ratio: measured.length === 0 ? null : Number(((measured.length - offenders.length) / measured.length).toFixed(3)),
    offenders: offenders.slice(0, 10)
  }
}

/** 单手可达：一级入口中心点落在视口下 60% 视为「拇指区可达」 */
const SCAN_ONE_HAND = () => {
  const vh = window.innerHeight
  // 只统计「内容入口」：宫格项与列表行。顶栏按钮天然在屏幕顶部，
  // 把它们算进来会让这个指标永远不达标，也测不出「内容入口是否下沉」。
  const entries = Array.from(document.querySelectorAll('.m-quick-item, .van-cell'))
    .map((el) => {
      const rect = el.getBoundingClientRect()
      return {
        text: (el.textContent ?? '').trim().slice(0, 18),
        centerYRatio: Number(((rect.top + rect.height / 2) / vh).toFixed(3)),
        h: Math.round(rect.height)
      }
    })
    .filter((e) => e.centerYRatio > 0 && e.centerYRatio <= 1)

  const reachable = entries.filter((e) => e.centerYRatio >= 0.4)
  return {
    total: entries.length,
    reachable: reachable.length,
    ratio: entries.length === 0 ? null : Number((reachable.length / entries.length).toFixed(3)),
    inTop40Percent: entries.filter((e) => e.centerYRatio < 0.4).slice(0, 10)
  }
}

const DOM_NODE_COUNT = () => document.querySelectorAll('*').length

test.describe('「我的」页体验基线', () => {
  test.setTimeout(240_000)
  test.skip(Boolean(SKIP_REASON), SKIP_REASON ?? '')

  test('采集触控热区、单手可达、首屏 TTI 与 DOM 规模', async ({ page }) => {
    const self = await registerMobileAccount('mymetrics')
    await seedE2EStorage(page)
    await autoDismissLocalUnlockGate(page)
    await loginOnMobileUi(page, { appUrl: MOBILE_APP_URL, account: self.username, password: self.password })
    await dismissLocalUnlockDialog(page, 10_000)
    await expect.poll(() => new URL(page.url()).pathname, { timeout: 45_000 }).not.toContain('/mobile/login')
    await page.waitForTimeout(1500)

    const viewport = page.viewportSize()

    // ── TTI：整页 reload 到「九宫格可见」的墙钟时间（含会话恢复，贴近真实冷启）
    const ttiStart = Date.now()
    await page.reload({ waitUntil: 'domcontentloaded' })
    let ttiMs: number | null = null
    try {
      await page.locator('.m-quick-actions').first().waitFor({ state: 'visible', timeout: 60_000 })
      ttiMs = Date.now() - ttiStart
    } catch {
      ttiMs = null // 客户端会话抖动（既有缺陷）时如实记 null，不编数字
    }

    // ── SPA 导航耗时：消息页 → 我的页，到九宫格可见。
    // 冷启 TTI 常因会话读取抖动拿不到（见 ttiMs 为 null 的情况），这个数字是稳定可回归的替代口径。
    await pushMobileRoute(page, { name: 'mobileMessage' })
    await page.waitForTimeout(600)
    const spaStart = Date.now()
    await page.evaluate(async () => {
      const router = (
        document.querySelector('#app') as
          | (HTMLElement & {
              __vue_app__?: { config: { globalProperties: { $router?: { push: (t: unknown) => Promise<unknown> } } } }
            })
          | null
      )?.__vue_app__?.config?.globalProperties?.$router
      await router?.push({ name: 'mobileMy' })
    })
    await expect(page.locator('.m-quick-actions').first()).toBeVisible({ timeout: 20_000 })
    const spaNavMs = Date.now() - spaStart

    const myHub = {
      ttiMs,
      spaNavMs,
      domNodes: await page.evaluate(DOM_NODE_COUNT),
      touchTargets: await page.evaluate(SCAN_TOUCH_TARGETS),
      oneHand: await page.evaluate(SCAN_ONE_HAND)
    }

    // ── 设置页：搜索框 + 20 个二级页入口，是触控问题最集中的地方（单选组行高小）
    await pushMobileRoute(page, '/mobile/mobileMy/settings')
    await expect(page.locator('.van-search input').first()).toBeVisible({ timeout: 20_000 })
    await page.waitForTimeout(600)

    const settings = {
      domNodes: await page.evaluate(DOM_NODE_COUNT),
      touchTargets: await page.evaluate(SCAN_TOUCH_TARGETS),
      oneHand: await page.evaluate(SCAN_ONE_HAND)
    }

    const report = {
      collectedAt: new Date().toISOString(),
      appUrl: MOBILE_APP_URL,
      viewport,
      myHub,
      settings
    }

    mkdirSync('test-results', { recursive: true })
    writeFileSync(OUTPUT_PATH, `${JSON.stringify(report, null, 2)}\n`, 'utf8')

    // 摘要打到 stdout，便于 CI 日志直接看
    console.log('[metrics]', JSON.stringify(report, null, 2))
    console.log(
      `[metrics] 我的页 TTI=${ttiMs ?? 'n/a'}ms · SPA 导航=${spaNavMs}ms · 触控合规 ${myHub.touchTargets.compliant}/${myHub.touchTargets.total}` +
        ` · 单手可达 ${myHub.oneHand.reachable}/${myHub.oneHand.total}` +
        ` · 设置页触控合规 ${settings.touchTargets.compliant}/${settings.touchTargets.total}` +
        ` · 写入 ${OUTPUT_PATH}`
    )

    // 采集脚本也要有最低门槛，否则「跑通了但全是 0」不会被发现
    expect(myHub.touchTargets.total, '首屏没扫到任何可点元素（选择器失效？）').toBeGreaterThan(3)
    expect(settings.touchTargets.total, '设置页没扫到任何可点元素（选择器失效？）').toBeGreaterThan(10)
  })
})
