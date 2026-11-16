import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
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

  it('配额本次取不到时同样整块隐藏，不显示 0', async () => {
    getQuotaStatsMock.mockResolvedValue({ ok: false, reason: 'unavailable' })

    const wrapper = mountNavigation()
    await flushPromises()

    expect(wrapper.text()).not.toContain('fileManager.storage.label')
    expect(wrapper.text()).not.toContain('fileManager.storage.count')
  })
})
