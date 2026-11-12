import type { Page } from '@playwright/test'

/**
 * 移动端体验指标的共用采集口径（G5 / G6）。
 *
 * 为什么单独抽出来：指标既要在 live 环境采（`my-hub-metrics.spec.ts`，含会话恢复），
 * 也要在无后端的 mock 环境下当 PR 门禁跑（`mobile-touch-targets.spec.ts`）。
 * 两处各写一份扫描逻辑，口径迟早漂移 —— 门禁就变成自欺欺人。
 */

/** 触控目标最小边（iOS HIG 44pt / Material 48dp 的常用下限） */
export const MIN_TOUCH_TARGET_PX = 44

/** 会话恢复预算：冷启 reload → `MatrixClient` 建成（P75，中端安卓） */
export const SESSION_RESTORE_BUDGET_MS = 1500

/** 首屏渲染预算：会话恢复完成 → 「我的」九宫格可见（P75，中端安卓） */
export const FIRST_SCREEN_RENDER_BUDGET_MS = 800

export interface TouchTargetItem {
  tag: string
  cls: string
  text: string
  w: number
  h: number
}

export interface TouchTargetReport {
  total: number
  compliant: number
  ratio: number | null
  offenders: TouchTargetItem[]
}

export interface OneHandEntry {
  text: string
  centerYRatio: number
  h: number
}

export interface OneHandReport {
  total: number
  reachable: number
  ratio: number | null
  inTop40Percent: OneHandEntry[]
}

/**
 * 可点元素扫描：只统计视口内、可见、有尺寸的。
 *
 * 有效热区要把 `::after/::before` 的负 inset 算进来：顶栏图标是 32×32 视觉盒 +
 * `after:-inset-8px`（= 48×48 命中区）。只看盒子会把这类实现误判成不合规。
 */
const scanTouchTargetsInPage = (minTouchTarget: number) => {
  const selector = 'button, a[href], [role="button"], .van-cell, .van-radio, .van-switch, .m-quick-item'
  const items = Array.from(document.querySelectorAll(selector)).filter((el) => {
    const rect = el.getBoundingClientRect()
    if (rect.width === 0 || rect.height === 0) return false
    if (rect.bottom < 0 || rect.top > window.innerHeight) return false
    const style = window.getComputedStyle(el)
    return style.visibility !== 'hidden' && style.display !== 'none'
  })

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

  const offenders = measured.filter((m) => Math.min(m.w, m.h) < minTouchTarget)
  return {
    total: measured.length,
    compliant: measured.length - offenders.length,
    ratio: measured.length === 0 ? null : Number(((measured.length - offenders.length) / measured.length).toFixed(3)),
    offenders: offenders.slice(0, 10)
  }
}

/** 单手可达：一级入口中心点落在视口下 60% 视为「拇指区可达」 */
const scanOneHandInPage = () => {
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

export const scanTouchTargets = async (page: Page): Promise<TouchTargetReport> =>
  // 阈值作为参数传进页面上下文：evaluate 的函数体会被序列化，取不到模块作用域常量
  page.evaluate(scanTouchTargetsInPage, MIN_TOUCH_TARGET_PX) as Promise<TouchTargetReport>

export const scanOneHand = async (page: Page): Promise<OneHandReport> =>
  page.evaluate(scanOneHandInPage) as Promise<OneHandReport>

export const countDomNodes = async (page: Page): Promise<number> =>
  page.evaluate(() => document.querySelectorAll('*').length)
