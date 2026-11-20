import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import {
  makeQuotaStats,
  makeQuotaStatsOk,
  makeQuotaStatsUnavailable
} from '@/services/matrix/media/__tests__/fixtures/quota'
import SideNavigation from '../SideNavigation.vue'

const { getQuotaStatsMock } = vi.hoisted(() => ({
  getQuotaStatsMock: vi.fn()
}))

vi.mock('@/services/matrix/media/MatrixMediaService', () => ({
  matrixMediaService: { getQuotaStats: getQuotaStatsMock }
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key })
}))

function mountNavigation() {
  return mount(SideNavigation, {
    global: {
      provide: {
        fileManagerState: {
          navigationItems: ref([
            { key: 'all', label: '全部文件', icon: 'icon-all', active: true },
            { key: 'media', label: '媒体', icon: 'icon-media', active: false }
          ]),
          setActiveNavigation: vi.fn()
        }
      }
    }
  })
}

describe('SideNavigation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('渲染服务端配额时展示存储用量与媒体数量', async () => {
    getQuotaStatsMock.mockResolvedValue({ ok: true, stats: { storageBytes: 2048, mediaCount: 37, limitBytes: 4096 } })

    const wrapper = mountNavigation()
    await flushPromises()

    expect(wrapper.text()).toContain('fileManager.storage.label')
    expect(wrapper.text()).toContain('fileManager.storage.count')
    expect(wrapper.text()).toContain('37')
  })

  it('服务端不支持配额时整块隐藏', async () => {
    getQuotaStatsMock.mockResolvedValue({ ok: false, reason: 'unsupported' })

    const wrapper = mountNavigation()
    await flushPromises()

    expect(wrapper.text()).not.toContain('fileManager.storage.label')
    expect(wrapper.text()).not.toContain('fileManager.storage.count')
  })

  it('配额本次取不到时提示暂不可用并提供重试，不显示 0', async () => {
    getQuotaStatsMock
      .mockResolvedValueOnce(makeQuotaStatsUnavailable())
      .mockResolvedValueOnce(makeQuotaStatsOk(makeQuotaStats({ storageBytes: 1024, mediaCount: 5, limitBytes: 4096 })))

    const wrapper = mountNavigation()
    await flushPromises()

    // unavailable ≠ unsupported：能力存在但本次取不到，应显式提示而非静默隐藏
    expect(wrapper.find('[data-testid="side-navigation-quota-unavailable"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('fileManager.storage.unavailable')
    expect(wrapper.text()).toContain('fileManager.common.retry')
    expect(wrapper.text()).not.toContain('fileManager.storage.count')

    await wrapper.find('[data-testid="side-navigation-quota-retry"]').trigger('click')
    await flushPromises()

    expect(wrapper.find('[data-testid="side-navigation-quota-unavailable"]').exists()).toBe(false)
    expect(wrapper.text()).toContain('fileManager.storage.count')
    expect(wrapper.text()).toContain('5')
  })

  it('配额请求未返回时展示占位，不把未取到渲染成无配额', () => {
    getQuotaStatsMock.mockReturnValue(new Promise(() => {}))

    const wrapper = mountNavigation()

    expect(wrapper.find('[data-testid="side-navigation-quota-loading"]').exists()).toBe(true)
    expect(wrapper.text()).not.toContain('fileManager.storage.count')
  })
})
