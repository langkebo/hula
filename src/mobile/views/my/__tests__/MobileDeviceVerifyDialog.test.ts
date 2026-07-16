import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import MobileDeviceVerifyDialog from '../MobileDeviceVerifyDialog.vue'

// Mutable mock state so each test can drive the composable's `step`.
const mockStep = ref('intro')
const mockLoading = ref(false)
const mockEmojis = ref<Array<{ emoji: string; description: string }>>([])
const mockPendingRequests = ref<
  Array<{ transactionId: string; userId: string; deviceId: string; methods: string[]; timestamp: number }>
>([])
const mockErrorMessage = ref<string | null>(null)
const mockCurrentTransactionId = ref<string | null>(null)

const startSasMock = vi.fn().mockResolvedValue(true)
const acceptVerificationMock = vi.fn().mockResolvedValue(true)
const confirmSasMock = vi.fn().mockResolvedValue(true)
const cancelVerificationMock = vi.fn().mockResolvedValue(undefined)
const refreshPendingRequestsMock = vi.fn().mockResolvedValue(undefined)
const resetMock = vi.fn()

vi.mock('@/composables/encryption/useDeviceVerifyFlow', () => ({
  useDeviceVerifyFlow: () => ({
    step: mockStep,
    loading: mockLoading,
    emojis: mockEmojis,
    pendingRequests: mockPendingRequests,
    errorMessage: mockErrorMessage,
    currentTransactionId: mockCurrentTransactionId,
    targetUserId: ref(''),
    targetDeviceId: ref(''),
    isIdle: ref(true),
    isVerifying: ref(false),
    isFinished: ref(false),
    startSas: (...args: any[]) => startSasMock(...args),
    acceptVerification: (...args: any[]) => acceptVerificationMock(...args),
    confirmSas: (...args: any[]) => confirmSasMock(...args),
    cancelVerification: (...args: any[]) => cancelVerificationMock(...args),
    refreshPendingRequests: (...args: any[]) => refreshPendingRequestsMock(...args),
    reset: (...args: any[]) => resetMock(...args)
  })
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key })
}))

vi.mock('@/utils/Logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  })
}))

const vanStubs = {
  'van-popup': {
    name: 'VanPopup',
    props: ['show', 'position', 'round', 'closeable', 'closeIconPosition'],
    emits: ['update:show'],
    template: '<div v-if="show" data-test="van-popup"><slot /></div>'
  },
  'van-nav-bar': {
    name: 'VanNavBar',
    props: ['title'],
    template: '<div data-test="van-nav-bar">{{ title }}</div>'
  },
  'van-button': {
    name: 'VanButton',
    props: ['type', 'block', 'plain', 'size'],
    template: '<button data-test="van-button" @click="$emit(\'click\')"><slot /></button>',
    emits: ['click']
  },
  'van-loading': {
    name: 'VanLoading',
    props: ['size', 'type'],
    template: '<div data-test="van-loading"><slot /></div>'
  },
  'van-empty': {
    name: 'VanEmpty',
    props: ['description', 'image'],
    template: '<div data-test="van-empty">{{ description }}</div>'
  },
  'van-cell-group': {
    name: 'VanCellGroup',
    props: ['inset'],
    template: '<div data-test="van-cell-group"><slot /></div>'
  },
  'van-cell': {
    name: 'VanCell',
    props: ['title', 'label', 'value', 'isLink'],
    template:
      '<div data-test="van-cell"><span class="title">{{ title }}</span><span class="label">{{ label }}</span><slot name="right-icon" /></div>'
  },
  'van-icon': {
    name: 'VanIcon',
    props: ['name', 'size', 'color'],
    template: '<i data-test="van-icon" />'
  }
}

describe('MobileDeviceVerifyDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockStep.value = 'intro'
    mockLoading.value = false
    mockEmojis.value = []
    mockPendingRequests.value = []
    mockErrorMessage.value = null
    mockCurrentTransactionId.value = null
  })

  it('renders intro step and shows the start SAS verification button', () => {
    const wrapper = mount(MobileDeviceVerifyDialog, {
      props: { visible: true },
      global: { stubs: vanStubs }
    })

    // Intro title is shown
    expect(wrapper.text()).toContain('verification.intro.title')
    // Start SAS verification button is rendered
    const buttons = wrapper.findAll('[data-test="van-button"]')
    const startBtn = buttons.find((b) => b.text().includes('verification.intro.start_sas'))
    expect(startBtn).toBeTruthy()
  })

  it('emits update:visible=false when close button clicked on success step', async () => {
    mockStep.value = 'success'
    const wrapper = mount(MobileDeviceVerifyDialog, {
      props: { visible: true },
      global: { stubs: vanStubs }
    })

    // Wait for the step watcher to emit 'verified'
    await vi.dynamicImportSettled()

    const buttons = wrapper.findAll('[data-test="van-button"]')
    const closeBtn = buttons.find((b) => b.text().includes('verification.actions.close'))
    expect(closeBtn).toBeTruthy()
    await closeBtn!.trigger('click')

    const updateEvents = wrapper.emitted('update:visible')
    expect(updateEvents).toBeTruthy()
    expect(updateEvents![0]).toEqual([false])
  })

  it('calls startSas when the start verification button is clicked', async () => {
    const wrapper = mount(MobileDeviceVerifyDialog, {
      props: { visible: true, userId: '@alice:example.com', deviceId: 'DEVICE_A' },
      global: { stubs: vanStubs }
    })

    const buttons = wrapper.findAll('[data-test="van-button"]')
    const startBtn = buttons.find((b) => b.text().includes('verification.intro.start_sas'))
    await startBtn!.trigger('click')

    expect(startSasMock).toHaveBeenCalledWith('@alice:example.com', 'DEVICE_A')
  })

  it('renders pending requests list when present', () => {
    mockPendingRequests.value = [
      {
        transactionId: 'txn-1',
        userId: '@bob:example.com',
        deviceId: 'BOB_DEV',
        methods: ['m.sas.v1'],
        timestamp: Date.now()
      }
    ]

    const wrapper = mount(MobileDeviceVerifyDialog, {
      props: { visible: true },
      global: { stubs: vanStubs }
    })

    expect(wrapper.text()).toContain('@bob:example.com')
    expect(wrapper.text()).toContain('BOB_DEV')
  })

  it('emits verified when step transitions to success', async () => {
    mount(MobileDeviceVerifyDialog, {
      props: { visible: true },
      global: { stubs: vanStubs }
    })

    mockStep.value = 'success'
    await vi.dynamicImportSettled()

    // The watcher should have fired emit('verified') via the wrapper.
    // Re-mount to capture emitted events properly.
    const wrapper = mount(MobileDeviceVerifyDialog, {
      props: { visible: true },
      global: { stubs: vanStubs }
    })
    mockStep.value = 'intro'
    await vi.dynamicImportSettled()
    mockStep.value = 'success'
    await vi.dynamicImportSettled()

    expect(wrapper.emitted('verified')).toBeTruthy()
  })
})
