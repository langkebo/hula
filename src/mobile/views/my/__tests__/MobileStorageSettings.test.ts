import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import MobileStorageSettings from '../MobileStorageSettings.vue'

/**
 * 移动端存储管理（方案 5.1）。
 *
 * ⚠️ 2026-10-13 更新（Batch 3.2）：本页原先还展示「缓存命中率 / 内存占用 / 缓存条目」
 * 并提供「清理缓存」按钮，二者都指向矩阵 worker 的 `getStats()` / `clearStores()`；
 * 取证确认该 worker **从不持有 MatrixClient**，所以三个统计项恒为 0/`-`、清理是 no-op
 * 却会弹「清理成功」。假数据与假成功已随 `workerClientHandlers` 一起删除。
 * 本文件现在锁两件事：① 浏览器存储用量（真实数据）仍正常展示；② **死灰不得复燃** ——
 * 页面不得再调用 worker 的这两个方法。
 */

const getStatsMock = vi.fn()
const clearStoresMock = vi.fn()

vi.mock('vant', async () => {
  const { defineComponent } = await import('vue')
  const passthrough = (name: string, tag = 'div') =>
    defineComponent({ name, inheritAttrs: false, template: `<${tag} v-bind="$attrs"><slot /></${tag}>` })
  return {
    showToast: vi.fn(),
    showConfirmDialog: vi.fn(),
    VanCellGroup: passthrough('VanCellGroup'),
    VanCell: passthrough('VanCell'),
    VanButton: passthrough('VanButton', 'button'),
    VanLoading: passthrough('VanLoading'),
    VanProgress: passthrough('VanProgress')
  }
})

vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }))
vi.mock('vue-router', () => ({ useRouter: () => ({ push: vi.fn(), back: vi.fn(), replace: vi.fn() }) }))
vi.mock('@/router', () => ({ default: { push: vi.fn(), back: vi.fn(), replace: vi.fn() } }))

// 保留 mock：若组件再度 import 并调用这两个方法，下面的断言会立刻判红
vi.mock('@/services/matrix/MatrixWorkerHost', () => ({
  matrixWorkerHost: {
    getStats: (...a: unknown[]) => getStatsMock(...a),
    clearStores: (...a: unknown[]) => clearStoresMock(...a)
  }
}))

vi.mock('@/utils/Logger', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() })
}))

vi.mock('@/mobile/components/chat-room/HeaderBar.vue', () => ({
  default: { name: 'HeaderBar', template: '<div />', props: ['border', 'isOfficial', 'hiddenRight', 'roomName'] }
}))

interface Vm {
  loading: boolean
  usage: number
  quota: number
  usagePercent: number
  usageText: string
  quotaText: string
  loadStats: () => Promise<void>
}

const mountPage = () => mount(MobileStorageSettings)
const vmOf = (w: ReturnType<typeof mount>) => w.vm as unknown as Vm

describe('MobileStorageSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // jsdom 没有 navigator.storage，补一个
    Object.defineProperty(navigator, 'storage', {
      configurable: true,
      value: { estimate: vi.fn().mockResolvedValue({ usage: 2048, quota: 4096 }) }
    })
  })

  it('挂载时加载浏览器存储用量（真实数据）', async () => {
    const wrapper = mountPage()
    await flushPromises()

    expect(vmOf(wrapper).usage).toBe(2048)
    expect(vmOf(wrapper).quota).toBe(4096)
    expect(vmOf(wrapper).loading).toBe(false)
  })

  it('字节格式化统一到 Formatting.formatBytes（B / KB / MB 档位）', async () => {
    const wrapper = mountPage()
    await flushPromises()

    expect(vmOf(wrapper).usageText).toBe('2 KB')
    expect(vmOf(wrapper).quotaText).toBe('4 KB')
  })

  it('用量占比按 quota 计算，quota 未知时为 0', async () => {
    const wrapper = mountPage()
    await flushPromises()
    expect(vmOf(wrapper).usagePercent).toBe(50)

    Object.defineProperty(navigator, 'storage', {
      configurable: true,
      value: { estimate: vi.fn().mockResolvedValue({ usage: 100, quota: 0 }) }
    })
    await vmOf(wrapper).loadStats()
    expect(vmOf(wrapper).usagePercent).toBe(0)
  })

  it('navigator.storage 不可用时不崩溃（降级为未知用量）', async () => {
    Object.defineProperty(navigator, 'storage', { configurable: true, value: undefined })

    const wrapper = mountPage()
    await flushPromises()

    expect(vmOf(wrapper).usage).toBe(0)
    expect(vmOf(wrapper).loading).toBe(false)
  })

  it('estimate 抛错时只记日志，不让 onMounted 抛未捕获错误', async () => {
    Object.defineProperty(navigator, 'storage', {
      configurable: true,
      value: { estimate: vi.fn().mockRejectedValue(new Error('boom')) }
    })

    const wrapper = mountPage()
    await flushPromises()

    expect(wrapper.exists()).toBe(true)
    expect(vmOf(wrapper).loading).toBe(false)
  })

  it('回归锁：页面不得再碰 worker 的 getStats / clearStores（假数据与假成功已删）', async () => {
    const wrapper = mountPage()
    await flushPromises()

    expect(getStatsMock).not.toHaveBeenCalled()
    expect(clearStoresMock).not.toHaveBeenCalled()
    expect('handleClear' in vmOf(wrapper)).toBe(false)
    // 假 UI 也不应回来
    const html = wrapper.html()
    expect(html).not.toContain('mobile_storage.cache_section')
    expect(html).not.toContain('mobile_storage.clear')
  })
})
