import { flushPromises, mount } from '@vue/test-utils'
import { showToast } from 'vant'
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
 * M9 之后「清理缓存」换成了真实删除搜索索引，入口按 `hasClearableIndex` 收敛，同样不经过 worker。
 */

const getStatsMock = vi.fn()
const clearStoresMock = vi.fn()

// 媒体缓存 store 会拉起 Pinia userStore 与 Tauri FS，测试里整体替换为可控假实现
const mediaCacheMock = vi.hoisted(() => ({
  autoCacheEnabled: { value: true },
  setAutoCacheEnabled: vi.fn(),
  getMediaCacheStats: vi.fn(),
  clearMediaCache: vi.fn()
}))

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
    VanProgress: passthrough('VanProgress'),
    VanSwitch: passthrough('VanSwitch')
  }
})

vi.mock('@/stores/domains/widget/thumbnailCache', () => ({
  useThumbnailCacheStore: () => ({
    get autoCacheEnabled() {
      return mediaCacheMock.autoCacheEnabled.value
    },
    setAutoCacheEnabled: mediaCacheMock.setAutoCacheEnabled,
    getMediaCacheStats: mediaCacheMock.getMediaCacheStats,
    clearMediaCache: mediaCacheMock.clearMediaCache
  })
}))

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

/**
 * 服务端媒体配额走 `matrixMediaService`（R1：复用既有服务层）。
 * 这里整体替换为可控假实现，避免测试真的去碰 MatrixClient。
 */
const mediaServiceMock = vi.hoisted(() => ({
  checkQuota: vi.fn(),
  getQuotaStats: vi.fn(),
  getQuotaAlerts: vi.fn()
}))

vi.mock('@/services/matrix/media/MatrixMediaService', () => ({ matrixMediaService: mediaServiceMock }))

vi.mock('@/utils/Logger', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() })
}))

vi.mock('@/mobile/components/chat-room/HeaderBar.vue', () => ({
  default: { name: 'HeaderBar', template: '<div />', props: ['border', 'isOfficial', 'hiddenRight', 'roomName'] }
}))

type MediaCacheKind = 'thumbnails' | 'emojis'
type MediaCacheUsage = { bytes: number; files: number }

interface ServerQuotaAlertFixture {
  alert_id: string
  alert_type: 'quota_warning' | 'quota_exceeded'
  threshold_percent: number
  current_usage_bytes: number
  quota_limit_bytes: number
  message: string
  created_ts: number
  is_read: boolean
}

interface Vm {
  loading: boolean
  statsAvailable: boolean
  usage: number
  quota: number
  usagePercent: number
  usageText: string
  quotaText: string
  loadStats: () => Promise<void>
  hasClearableIndex: boolean
  mediaStats: Record<MediaCacheKind, MediaCacheUsage>
  mediaCacheAvailable: boolean
  hasClearableMedia: (kind: MediaCacheKind) => boolean
  mediaCacheTextFor: (kind: MediaCacheKind) => string
  handleToggleAutoCache: (value: string | number | boolean) => void
  handleClearMedia: (kind: MediaCacheKind) => Promise<void>
  serverQuotaState: 'loading' | 'available' | 'unavailable'
  serverQuotaUsed: number
  serverQuotaLimit: number
  serverQuotaRemaining: number
  serverQuotaMediaCount: number | null
  serverQuotaAlerts: ServerQuotaAlertFixture[]
  serverQuotaAlertsUnavailable: boolean
  serverQuotaExceeded: boolean
  loadServerQuota: () => Promise<void>
  serverQuotaAlertMeta: (alert: ServerQuotaAlertFixture) => string
}

const mountPage = () => mount(MobileStorageSettings)
const vmOf = (w: ReturnType<typeof mount>) => w.vm as unknown as Vm

/** 按类别返回可控统计，便于分别验证「缩略图 / 表情」两条路径 */
const mockStatsByKind = (initial: Record<MediaCacheKind, MediaCacheUsage>) => {
  const stats: Record<MediaCacheKind, MediaCacheUsage> = {
    thumbnails: { ...initial.thumbnails },
    emojis: { ...initial.emojis }
  }
  mediaCacheMock.getMediaCacheStats.mockImplementation((kind: MediaCacheKind) => Promise.resolve({ ...stats[kind] }))
  mediaCacheMock.clearMediaCache.mockImplementation((kind: MediaCacheKind) => {
    stats[kind] = { bytes: 0, files: 0 }
    return Promise.resolve()
  })
  return stats
}

describe('MobileStorageSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mediaCacheMock.autoCacheEnabled.value = true
    mockStatsByKind({ thumbnails: { bytes: 0, files: 0 }, emojis: { bytes: 0, files: 0 } })
    // jsdom 没有 navigator.storage，补一个
    Object.defineProperty(navigator, 'storage', {
      configurable: true,
      value: { estimate: vi.fn().mockResolvedValue({ usage: 2048, quota: 4096 }) }
    })
    // 服务端配额默认成功：老用例不必关心这一块
    mediaServiceMock.checkQuota.mockResolvedValue({
      limit: 4096,
      used: 1024,
      remaining: 3072
    })
    mediaServiceMock.getQuotaStats.mockResolvedValue({
      ok: true,
      stats: { storageBytes: 1024, mediaCount: 7, limitBytes: 4096 }
    })
    mediaServiceMock.getQuotaAlerts.mockResolvedValue({ ok: true, alerts: [] })
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

  it('navigator.storage 不可用时不崩溃，且标记用量不可用（不显示 0 B）', async () => {
    Object.defineProperty(navigator, 'storage', { configurable: true, value: undefined })

    const wrapper = mountPage()
    await flushPromises()

    expect(vmOf(wrapper).statsAvailable).toBe(false)
    expect(vmOf(wrapper).loading).toBe(false)
    // 不可用时不能把 0 B / 0% 当作真实用量
    expect(wrapper.html()).toContain('mobile_storage.stats_unavailable')
    expect(wrapper.find('van-progress').exists()).toBe(false)
  })

  it('estimate 抛错时标记不可用，但媒体缓存统计仍照常加载', async () => {
    Object.defineProperty(navigator, 'storage', {
      configurable: true,
      value: { estimate: vi.fn().mockRejectedValue(new Error('boom')) }
    })
    mockStatsByKind({ thumbnails: { bytes: 3084, files: 3 }, emojis: { bytes: 0, files: 0 } })

    const wrapper = mountPage()
    await flushPromises()

    expect(wrapper.exists()).toBe(true)
    expect(vmOf(wrapper).statsAvailable).toBe(false)
    expect(vmOf(wrapper).loading).toBe(false)
    expect(vmOf(wrapper).mediaStats.thumbnails).toEqual({ bytes: 3084, files: 3 })
  })

  it('重试后恢复可用状态并展示真实用量', async () => {
    Object.defineProperty(navigator, 'storage', { configurable: true, value: undefined })
    const wrapper = mountPage()
    await flushPromises()
    expect(vmOf(wrapper).statsAvailable).toBe(false)

    Object.defineProperty(navigator, 'storage', {
      configurable: true,
      value: { estimate: vi.fn().mockResolvedValue({ usage: 2048, quota: 4096 }) }
    })
    await vmOf(wrapper).loadStats()

    expect(vmOf(wrapper).statsAvailable).toBe(true)
    expect(vmOf(wrapper).usageText).toBe('2 KB')
  })

  it('回归锁：页面不得再碰 worker 的 getStats / clearStores（假数据与假成功已删）', async () => {
    const wrapper = mountPage()
    await flushPromises()

    expect(getStatsMock).not.toHaveBeenCalled()
    expect(clearStoresMock).not.toHaveBeenCalled()
    // 索引为空时清理入口应为禁用态（M9 起清理是真实删除搜索索引，不可空跑）
    expect(vmOf(wrapper).hasClearableIndex).toBe(false)
    // 假 UI 也不应回来（缓存命中率/清理缓存分区已删除）
    expect(wrapper.html()).not.toContain('mobile_storage.cache_section')
  })

  it('缩略图与表情缓存按类别分开统计（不再合并成一个数字）', async () => {
    mockStatsByKind({ thumbnails: { bytes: 3084, files: 3 }, emojis: { bytes: 1024, files: 2 } })

    const wrapper = mountPage()
    await flushPromises()

    expect(mediaCacheMock.getMediaCacheStats).toHaveBeenCalledWith('thumbnails')
    expect(mediaCacheMock.getMediaCacheStats).toHaveBeenCalledWith('emojis')
    expect(vmOf(wrapper).mediaStats.thumbnails).toEqual({ bytes: 3084, files: 3 })
    expect(vmOf(wrapper).mediaStats.emojis).toEqual({ bytes: 1024, files: 2 })
    expect(vmOf(wrapper).hasClearableMedia('thumbnails')).toBe(true)
    expect(vmOf(wrapper).hasClearableMedia('emojis')).toBe(true)
    expect(vmOf(wrapper).mediaCacheTextFor('thumbnails')).toBe('mobile_storage.media_cache_size')
  })

  it('某一类为空时只有该类不可清理，另一类不受影响', async () => {
    mockStatsByKind({ thumbnails: { bytes: 3084, files: 3 }, emojis: { bytes: 0, files: 0 } })

    const wrapper = mountPage()
    await flushPromises()

    expect(vmOf(wrapper).hasClearableMedia('thumbnails')).toBe(true)
    expect(vmOf(wrapper).hasClearableMedia('emojis')).toBe(false)
    expect(vmOf(wrapper).mediaCacheTextFor('emojis')).toBe('mobile_storage.media_cache_empty')
  })

  it('读不到媒体缓存目录时标记不可用，不谎报「无缓存」', async () => {
    mediaCacheMock.getMediaCacheStats.mockRejectedValue(new Error('not a tauri env'))

    const wrapper = mountPage()
    await flushPromises()

    expect(vmOf(wrapper).mediaCacheAvailable).toBe(false)
    expect(vmOf(wrapper).hasClearableMedia('thumbnails')).toBe(false)
    expect(vmOf(wrapper).hasClearableMedia('emojis')).toBe(false)
    expect(vmOf(wrapper).mediaCacheTextFor('thumbnails')).toBe('mobile_storage.unavailable')
  })

  it('自动缓存开关调用 store 的真实 setter', async () => {
    const wrapper = mountPage()
    await flushPromises()

    vmOf(wrapper).handleToggleAutoCache(false)
    expect(mediaCacheMock.setAutoCacheEnabled).toHaveBeenCalledWith(false)
    vmOf(wrapper).handleToggleAutoCache('1')
    expect(mediaCacheMock.setAutoCacheEnabled).toHaveBeenLastCalledWith(true)
  })

  it('清理表情缓存只清该类，缩略图统计保持不变', async () => {
    mockStatsByKind({ thumbnails: { bytes: 2048, files: 2 }, emojis: { bytes: 512, files: 1 } })

    const wrapper = mountPage()
    await flushPromises()

    await vmOf(wrapper).handleClearMedia('emojis')

    expect(mediaCacheMock.clearMediaCache).toHaveBeenCalledTimes(1)
    expect(mediaCacheMock.clearMediaCache).toHaveBeenCalledWith('emojis')
    expect(vmOf(wrapper).mediaStats.emojis).toEqual({ bytes: 0, files: 0 })
    expect(vmOf(wrapper).mediaStats.thumbnails).toEqual({ bytes: 2048, files: 2 })
    expect(vmOf(wrapper).hasClearableMedia('thumbnails')).toBe(true)
  })

  it('清理缩略图缓存调用 store 的 thumbnails 分支', async () => {
    mockStatsByKind({ thumbnails: { bytes: 2048, files: 2 }, emojis: { bytes: 512, files: 1 } })

    const wrapper = mountPage()
    await flushPromises()

    await vmOf(wrapper).handleClearMedia('thumbnails')

    expect(mediaCacheMock.clearMediaCache).toHaveBeenCalledWith('thumbnails')
    expect(vmOf(wrapper).mediaStats.thumbnails).toEqual({ bytes: 0, files: 0 })
    expect(vmOf(wrapper).hasClearableMedia('emojis')).toBe(true)
  })

  it('清理失败时弹失败提示，不静默当成功', async () => {
    mockStatsByKind({ thumbnails: { bytes: 2048, files: 2 }, emojis: { bytes: 0, files: 0 } })
    mediaCacheMock.clearMediaCache.mockRejectedValue(new Error('permission denied'))

    const wrapper = mountPage()
    await flushPromises()

    await vmOf(wrapper).handleClearMedia('thumbnails')

    expect(vmOf(wrapper).hasClearableMedia('thumbnails')).toBe(true)
    expect(vi.mocked(showToast)).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'fail', message: 'mobile_storage.clear_cache_failed' })
    )
  })

  it('展示服务端媒体配额（与浏览器存储用量分开）', async () => {
    const wrapper = mountPage()
    await flushPromises()

    const vm = vmOf(wrapper)
    expect(vm.serverQuotaState).toBe('available')
    expect(vm.serverQuotaUsed).toBe(1024)
    expect(vm.serverQuotaLimit).toBe(4096)
    expect(vm.serverQuotaRemaining).toBe(3072)
    expect(vm.serverQuotaMediaCount).toBe(7)
    expect(wrapper.html()).toContain('mobile_storage.server_quota_section')
    expect(wrapper.html()).toContain('mobile_storage.server_quota_no_alerts')
  })

  it('配额读取失败时整块标记不可用，不用 0 B 冒充用量；重试后恢复', async () => {
    mediaServiceMock.checkQuota.mockResolvedValueOnce(null)

    const wrapper = mountPage()
    await flushPromises()

    expect(vmOf(wrapper).serverQuotaState).toBe('unavailable')
    expect(wrapper.html()).toContain('mobile_storage.server_quota_unavailable')

    await vmOf(wrapper).loadServerQuota()

    expect(vmOf(wrapper).serverQuotaState).toBe('available')
    expect(vmOf(wrapper).serverQuotaUsed).toBe(1024)
  })

  it('服务端无配额统计接口时媒体数显示占位，不谎报 0 个', async () => {
    mediaServiceMock.getQuotaStats.mockResolvedValue({ ok: false, reason: 'unsupported' })

    const wrapper = mountPage()
    await flushPromises()

    expect(vmOf(wrapper).serverQuotaMediaCount).toBeNull()
    expect(wrapper.html()).toContain('mobile_storage.server_quota_partial_desc')
  })

  it('告警读取失败时显示「告警暂不可用」，不画成「暂无告警」', async () => {
    mediaServiceMock.getQuotaAlerts.mockResolvedValue({ ok: false, reason: 'unavailable' })

    const wrapper = mountPage()
    await flushPromises()

    expect(vmOf(wrapper).serverQuotaAlertsUnavailable).toBe(true)
    expect(wrapper.find('[data-testid="server-quota-alerts-unavailable"]').exists()).toBe(true)
    expect(wrapper.html()).toContain('mobile_storage.server_quota_alerts_unavailable')
    expect(wrapper.html()).not.toContain('mobile_storage.server_quota_no_alerts')
  })

  it('剩余为 0 时标记配额用尽，未读告警保留原文与类型/阈值副行', async () => {
    mediaServiceMock.checkQuota.mockResolvedValue({ limit: 4096, used: 4096, remaining: 0 })
    mediaServiceMock.getQuotaAlerts.mockResolvedValue({
      ok: true,
      alerts: [
        {
          alert_id: 'a-1',
          alert_type: 'quota_exceeded',
          threshold_percent: 100,
          current_usage_bytes: 4096,
          quota_limit_bytes: 4096,
          message: 'quota exceeded',
          created_ts: 1,
          is_read: false
        }
      ]
    })

    const wrapper = mountPage()
    await flushPromises()

    const vm = vmOf(wrapper)
    expect(vm.serverQuotaExceeded).toBe(true)
    expect(wrapper.find('[data-testid="server-quota-exceeded"]').exists()).toBe(true)
    expect(wrapper.findAll('[data-testid="server-quota-alert"]')).toHaveLength(1)
    // 未读标记在具名插槽里；van-cell 在本套件是未注册组件（只渲染属性），因此断言数据侧
    expect(vm.serverQuotaAlerts[0].is_read).toBe(false)
    expect(vm.serverQuotaAlertMeta(vm.serverQuotaAlerts[0])).toBe('mobile_storage.server_quota_alert_meta')
  })
})
