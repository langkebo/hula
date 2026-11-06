import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * `PlatformDetector` 的「显式平台覆盖」分支。
 *
 * 背景：此前无 Tauri runtime 时 `_platformType` 被硬编码为 `desktop`，而路由层
 * `usePlatform().detectPlatform()` 认 `requestedPlatform` ⇒ 浏览器里出现
 * 「页面是移动端、输入栏是桌面端」的混合态（`MsgInput` 的 `v-if="isMobileRef"` 永不渲染，
 * e2e 因此看不到 `+` → More 面板 → 附件选择器）。
 *
 * 这里必须用 `vi.resetModules()` + 动态 import：检测结果是**类静态字段 + 只初始化一次**，
 * 同一模块实例上无法重跑，只能每次拿一份新的模块图。
 */

const osMock = vi.hoisted(() => ({
  type: vi.fn(() => 'windows'),
  version: vi.fn(() => '10.0.19045')
}))

const harness = vi.hoisted(() => ({
  hasTauriRuntime: vi.fn(() => false)
}))

const PLATFORM_STORAGE_KEY = 'tjg:e2e:platform'

/** 拿一份全新的 PlatformConstants 模块并完成初始化 */
const loadDetector = async (): Promise<typeof import('../PlatformConstants')> => {
  vi.resetModules()
  vi.doMock('@tauri-apps/plugin-os', () => osMock)
  vi.doMock('@/utils/AppHarness', () => ({ hasTauriRuntime: harness.hasTauriRuntime }))
  const mod = await import('../PlatformConstants')
  mod.initializePlatform()
  return mod
}

const setSearch = (search: string): void => {
  window.history.replaceState({}, '', search)
}

beforeEach(() => {
  window.localStorage.clear()
  setSearch('/')
  osMock.type.mockReset().mockReturnValue('windows')
  osMock.version.mockReset().mockReturnValue('10.0.19045')
  harness.hasTauriRuntime.mockReset().mockReturnValue(false)
})

afterEach(() => {
  vi.doUnmock('@tauri-apps/plugin-os')
  vi.doUnmock('@/utils/AppHarness')
  window.localStorage.clear()
  setSearch('/')
})

describe('PlatformDetector 显式平台覆盖（浏览器/E2E）', () => {
  it('没有覆盖标记时保持 desktop 默认值（不因浏览器 UA 改变）', async () => {
    const mod = await loadDetector()
    expect(mod.getPlatformType()).toBe('desktop')
    expect(mod.isDesktop()).toBe(true)
    expect(mod.isMobile()).toBe(false)
    // 浏览器态没有真实 OS，仍沿用既有的 windows 默认值
    expect(mod.getOSType()).toBe('windows')
  })

  it('localStorage 标记 mobile 时判定为移动端', async () => {
    window.localStorage.setItem(PLATFORM_STORAGE_KEY, 'mobile')
    const mod = await loadDetector()
    expect(mod.getPlatformType()).toBe('mobile')
    expect(mod.isMobile()).toBe(true)
    expect(mod.isDesktop()).toBe(false)
    expect(mod.isAndroid()).toBe(true)
  })

  it('查询参数 ?platform=mobile 同样生效（与 localStorage 等价的入口）', async () => {
    setSearch('/?platform=mobile')
    const mod = await loadDetector()
    expect(mod.getPlatformType()).toBe('mobile')
    expect(mod.isMobile()).toBe(true)
  })

  it('查询参数优先于 localStorage', async () => {
    setSearch('/?platform=desktop')
    window.localStorage.setItem(PLATFORM_STORAGE_KEY, 'mobile')
    const mod = await loadDetector()
    expect(mod.getPlatformType()).toBe('desktop')
    expect(mod.isDesktop()).toBe(true)
  })

  it('非法取值被忽略，回落 desktop 默认', async () => {
    setSearch('/?platform=tablet')
    window.localStorage.setItem(PLATFORM_STORAGE_KEY, 'watch')
    const mod = await loadDetector()
    expect(mod.getPlatformType()).toBe('desktop')
  })

  it('有 Tauri runtime 时仍走 plugin-os 检测（覆盖标记不参与）', async () => {
    harness.hasTauriRuntime.mockReturnValue(true)
    osMock.type.mockReturnValue('android')
    const mod = await loadDetector()
    expect(mod.getPlatformType()).toBe('mobile')
    expect(mod.getOSType()).toBe('android')
  })

  it('长生命周期：覆盖标记只在初始化时读一次，后续写入不再改变结果', async () => {
    const mod = await loadDetector()
    expect(mod.getPlatformType()).toBe('desktop')

    window.localStorage.setItem(PLATFORM_STORAGE_KEY, 'mobile')
    mod.initializePlatform()
    expect(mod.getPlatformType()).toBe('desktop')
  })
})
