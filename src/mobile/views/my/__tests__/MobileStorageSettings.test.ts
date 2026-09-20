import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import MobileStorageSettings from '../MobileStorageSettings.vue'

/**
 * 移动端存储管理（方案 5.1）。
 *
 * 缺口背景：桌面 `StorageSettings.vue` 展示缓存命中率 + 浏览器存储用量/配额，
 * 并提供清理缓存入口；移动端**没有任何存储可见性**，排查问题成本高。
 */

const getStatsMock = vi.fn()
const clearStoresMock = vi.fn()
const showToastMock = vi.fn()
const showConfirmDialogMock = vi.fn().mockResolvedValue(undefined)

vi.mock('vant', async () => {
  const { defineComponent } = await import('vue')
  const passthrough = (name: string, tag = 'div') =>
    defineComponent({ name, inheritAttrs: false, template: `<${tag} v-bind="$attrs"><slot /></${tag}>` })
  return {
    showToast: (...args: any[]) => showToastMock(...args),
    showConfirmDialog: (...args: any[]) => showConfirmDialogMock(...args),
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

vi.mock('@/services/matrix/MatrixWorkerHost', () => ({
  matrixWorkerHost: {
    getStats: (...a: any[]) => getStatsMock(...a),
    clearStores: (...a: any[]) => clearStoresMock(...a)
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
  clearing: boolean
  stats: { hitRate: number; totalEntries: number } | null
  usage: number
  quota: number
  hitRateText: string
  usageText: string
  formatBytes: (b?: number) => string
  loadStats: () => Promise<void>
  handleClear: () => Promise<void>
}

const mountPage = () => mount(MobileStorageSettings)
const vmOf = (w: ReturnType<typeof mount>) => w.vm as unknown as Vm

describe('MobileStorageSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getStatsMock.mockResolvedValue({
      hitRate: 0.8,
      totalEntries: 12,
      memoryUsageBytes: 1024,
      hits: 8,
      misses: 2,
      evictions: 0
    })
    clearStoresMock.mockResolvedValue(undefined)
    // jsdom 没有 navigator.storage，补一个
    Object.defineProperty(navigator, 'storage', {
      configurable: true,
      value: { estimate: vi.fn().mockResolvedValue({ usage: 2048, quota: 4096 }) }
    })
  })

  it('挂载时加载缓存统计与存储用量', async () => {
    const wrapper = mountPage()
    await flushPromises()

    expect(getStatsMock).toHaveBeenCalled()
    expect(vmOf(wrapper).usage).toBe(2048)
    expect(vmOf(wrapper).quota).toBe(4096)
  })

  it('缓存命中率格式化为百分比', async () => {
    const wrapper = mountPage()
    await flushPromises()

    expect(vmOf(wrapper).hitRateText).toBe('80.0%')
  })

  it('字节格式化覆盖 B / KB / MB 三档', async () => {
    const wrapper = mountPage()
    await flushPromises()

    expect(vmOf(wrapper).formatBytes(512)).toBe('512 B')
    expect(vmOf(wrapper).formatBytes(2048)).toBe('2.0 KB')
    expect(vmOf(wrapper).formatBytes(3 * 1024 * 1024)).toBe('3.0 MB')
    expect(vmOf(wrapper).formatBytes(undefined)).toBe('-')
  })

  it('navigator.storage 不可用时不崩溃（降级为未知用量）', async () => {
    Object.defineProperty(navigator, 'storage', { configurable: true, value: undefined })

    const wrapper = mountPage()
    await flushPromises()

    expect(vmOf(wrapper).usage).toBe(0)
    expect(vmOf(wrapper).loading).toBe(false)
  })

  it('清理缓存：二次确认后调用 clearStores 并刷新', async () => {
    const wrapper = mountPage()
    await flushPromises()
    const vm = vmOf(wrapper)

    await vm.handleClear()

    expect(showConfirmDialogMock).toHaveBeenCalled()
    expect(clearStoresMock).toHaveBeenCalled()
    // 清理后再取一次统计
    expect(getStatsMock).toHaveBeenCalledTimes(2)
  })

  it('清理缓存：用户取消时不调用 clearStores', async () => {
    showConfirmDialogMock.mockRejectedValueOnce('cancel')
    const wrapper = mountPage()
    await flushPromises()

    await vmOf(wrapper).handleClear()

    expect(clearStoresMock).not.toHaveBeenCalled()
  })

  it('清理失败时提示错误且 clearing 归位', async () => {
    clearStoresMock.mockRejectedValueOnce(new Error('boom'))
    const wrapper = mountPage()
    await flushPromises()
    const vm = vmOf(wrapper)

    await vm.handleClear()

    expect(vm.clearing).toBe(false)
    expect(showToastMock).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'fail', message: 'mobile_storage.clear_failed' })
    )
  })
})
