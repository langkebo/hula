import { flushPromises, shallowMount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import WidgetManager from '../WidgetManager.vue'

const {
  dialogMock,
  showFeedbackMock,
  openExternalUrlMock,
  loadWidgetsMock,
  loadPermissionsMock,
  createWidgetMock,
  removeWidgetMock,
  grantPermissionMock,
  revokePermissionMock
} = vi.hoisted(() => ({
  dialogMock: {
    warning: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
    success: vi.fn()
  },
  showFeedbackMock: vi.fn(),
  openExternalUrlMock: vi.fn(),
  loadWidgetsMock: vi.fn().mockResolvedValue(undefined),
  loadPermissionsMock: vi.fn().mockResolvedValue(undefined),
  createWidgetMock: vi.fn().mockResolvedValue({ id: 'w3', type: 'custom', url: '', name: '' }),
  removeWidgetMock: vi.fn().mockResolvedValue(true),
  grantPermissionMock: vi.fn().mockResolvedValue(true),
  revokePermissionMock: vi.fn().mockResolvedValue(true)
}))

vi.mock('naive-ui', async () => {
  const { defineComponent } = await import('vue')
  const stub = defineComponent({ name: 'NaiveStub', render: () => null })
  return {
    useDialog: () => dialogMock,
    NButton: stub,
    NIcon: stub,
    NInput: stub,
    NDivider: stub,
    NDescriptions: stub,
    NDescriptionsItem: stub,
    NSpin: stub,
    NEmpty: stub,
    NTabs: stub,
    NTabPane: stub,
    NModal: stub,
    NForm: stub,
    NFormItem: stub,
    NSelect: stub,
    NTag: stub,
    NPopconfirm: stub,
    NCheckbox: stub
  }
})

vi.mock('@iconify/vue', () => ({
  Icon: { name: 'Icon', render: () => null }
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key })
}))

vi.mock('@/composables/common/useActionFeedback', () => ({
  useActionFeedback: () => ({ showFeedback: showFeedbackMock })
}))

vi.mock('@/composables/common/useLinkSegments', () => ({
  openExternalUrl: openExternalUrlMock
}))

vi.mock('@/composables/widget', async () => {
  const { ref } = await import('vue')
  return {
    useWidgets: () => ({
      widgets: ref([
        { id: 'w1', type: 'custom', url: 'https://example.com/widget1', name: 'Widget One' },
        { id: 'w2', type: 'jitsi', url: 'https://meet.example.com', name: 'Video Widget' }
      ]),
      loading: ref(false),
      mutating: ref(false),
      load: loadWidgetsMock,
      create: createWidgetMock,
      remove: removeWidgetMock
    }),
    useWidgetPermissions: () => ({
      rows: ref([]),
      loading: ref(false),
      mutating: ref(false),
      load: loadPermissionsMock,
      grant: grantPermissionMock,
      revoke: revokePermissionMock
    })
  }
})

vi.mock('@/services/matrix/widget/MatrixWidgetService', () => ({
  matrixWidgetService: {
    getWidgetById: vi.fn().mockResolvedValue(null),
    getWidgetConfig: vi.fn().mockResolvedValue({}),
    getWidgetCapabilities: vi.fn().mockResolvedValue({ capabilities: [] }),
    getWidgetSessions: vi.fn().mockResolvedValue([]),
    updateWidget: vi.fn().mockResolvedValue(null),
    setWidgetCapabilities: vi.fn().mockResolvedValue(null),
    sendWidgetMessage: vi.fn().mockResolvedValue(null),
    terminateWidgetSession: vi.fn().mockResolvedValue(true)
  }
}))

vi.mock('@/utils/Logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    trace: vi.fn()
  })
}))

const mountManager = async () => {
  const wrapper = shallowMount(WidgetManager, {
    props: { roomId: '!test:matrix.org' },
    global: {
      renderStubDefaultSlot: true
    }
  })
  await flushPromises()
  return wrapper
}

describe('WidgetManager', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders without crashing', async () => {
    const wrapper = await mountManager()
    expect(wrapper.exists()).toBe(true)
    expect(wrapper.find('.widget-manager').exists()).toBe(true)
  })

  it('renders the widget list with items', async () => {
    const wrapper = await mountManager()
    expect(wrapper.find('.widget-list').exists()).toBe(true)
    const items = wrapper.findAll('.widget-item')
    expect(items.length).toBe(2)
  })

  it('renders the search bar', async () => {
    const wrapper = await mountManager()
    expect(wrapper.find('.widget-search-bar').exists()).toBe(true)
  })
})
