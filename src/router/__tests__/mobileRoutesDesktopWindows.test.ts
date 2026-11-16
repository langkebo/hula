import { describe, expect, it } from 'vitest'
import { getMobileRoutes } from '../routes/mobile'

/**
 * 平台边界的**前提**判据（§19.25）。
 *
 * `useVideoViewer.openVideoViewer` 里原本有一道 `isMobile()` 早退守卫，本轮删掉了 ——
 * 依据是「移动端根本走不到这条链路」：
 *   1. `renderMessage/Video.vue` 在移动端先走内嵌 `VideoPreview` 并 `return`；
 *   2. 另一个调用方 `views/multiMsgWindow` 与查看器宿主 `views/videoViewerWindow`
 *      都是 **Tauri 独立窗口**，移动端路由表里没有它们。
 *
 * 第 2 条是「前提」而不是「实现细节」：一旦有人把这类桌面窗口挂进移动端路由，
 * 删守卫就变成真缺陷（移动端会去开一个不存在的窗口）。这条用例就是为了让那个前提失效时**立刻变红**。
 */
const flattenPaths = (routes: ReturnType<typeof getMobileRoutes>): string[] => {
  const out: string[] = []
  const walk = (list: ReturnType<typeof getMobileRoutes>) => {
    for (const route of list) {
      if (typeof route.path === 'string') out.push(route.path)
      if (route.children) walk(route.children as ReturnType<typeof getMobileRoutes>)
    }
  }
  walk(routes)
  return out
}

describe('移动端路由表 — 不含桌面独立窗口', () => {
  it('没有 multiMsgWindow / videoViewerWindow 之类的桌面窗口路由', () => {
    const paths = flattenPaths(getMobileRoutes())

    expect(paths.some((path) => /multiMsg/i.test(path))).toBe(false)
    expect(paths.some((path) => /videoViewer/i.test(path))).toBe(false)
  })

  it('确实挂载了移动端自己的视频/图片查看器（否则上面的判据会假绿）', () => {
    const paths = flattenPaths(getMobileRoutes())

    // MediaViewer 是移动端自己的媒体查看页 —— 它的存在证明「移动端不走桌面查看器」不是空话
    expect(paths.some((path) => /mediaViewer/i.test(path))).toBe(true)
  })
})
