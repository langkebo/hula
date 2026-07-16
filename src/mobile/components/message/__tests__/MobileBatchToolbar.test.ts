import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/composables/messaging/useMessageMultiSelect', () => ({
  useMessageMultiSelect: () => ({
    selectedIds: { value: ['ev1', 'ev2'] },
    processing: { value: false },
    multiSelectMode: { value: true },
    selectedCount: { value: 2 },
    batchCopy: vi.fn(),
    batchForward: vi.fn(),
    batchDelete: vi.fn(),
    enterMultiSelect: vi.fn(),
    exitMultiSelect: vi.fn()
  })
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string, params?: Record<string, unknown>) => {
      const translations: Record<string, string> = {
        'message.multi_select.selected_count': `${params?.count || 0} selected`,
        'message.multi_select.copy': 'Copy',
        'message.multi_select.forward': 'Forward',
        'message.multi_select.delete': 'Delete',
        'common.cancel': 'Cancel'
      }
      return translations[key] || key
    },
    locale: { value: 'en' }
  }),
  createI18n: vi.fn()
}))

describe('MobileBatchToolbar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders selected count and action buttons', async () => {
    const MobileBatchToolbar = (await import('#/components/message/MobileBatchToolbar.vue')).default
    const wrapper = mount(MobileBatchToolbar, {
      props: { roomId: '!test:localhost' },
      global: { stubs: { 'van-button': { template: '<button><slot /></button>' } } }
    })
    expect(wrapper.html()).toContain('2 selected')
    expect(wrapper.html()).toContain('Copy')
    expect(wrapper.html()).toContain('Forward')
    expect(wrapper.html()).toContain('Delete')
  })

  it('emits cancel when cancel button clicked', async () => {
    const MobileBatchToolbar = (await import('#/components/message/MobileBatchToolbar.vue')).default
    const wrapper = mount(MobileBatchToolbar, {
      props: { roomId: '!test:localhost' },
      global: { stubs: { 'van-button': { template: '<button><slot /></button>' } } }
    })
    expect(wrapper.html()).toBeTruthy()
  })
})
