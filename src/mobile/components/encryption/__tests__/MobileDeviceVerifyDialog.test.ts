import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import MobileDeviceVerifyDialog from '../MobileDeviceVerifyDialog.vue'

// Shared reactive state used by the composable mock so tests can manipulate it
const mockStep = ref<string>('intro')
const mockEmojis = ref<Array<{ emoji: string; description: string }>>([])
const mockPendingRequests = ref<
  Array<{ transactionId: string; userId: string; deviceId: string; methods: string[]; timestamp: number }>
>([])
const mockErrorMessage = ref<string | null>(null)
const mockStartSas = vi.fn()
const mockConfirmSas = vi.fn()
const mockCancelVerification = vi.fn()
const mockAcceptVerification = vi.fn()
const mockRefreshPendingRequests = vi.fn()
const mockReset = vi.fn()

vi.mock('@/composables/encryption/useDeviceVerifyFlow', () => ({
  useDeviceVerifyFlow: () => ({
    step: mockStep,
    emojis: mockEmojis,
    pendingRequests: mockPendingRequests,
    errorMessage: mockErrorMessage,
    startSas: mockStartSas,
    confirmSas: mockConfirmSas,
    cancelVerification: mockCancelVerification,
    acceptVerification: mockAcceptVerification,
    refreshPendingRequests: mockRefreshPendingRequests,
    reset: mockReset
  })
}))

vi.mock('@/services/matrix/crypto/MatrixVerificationService', () => ({
  matrixVerificationService: {
    cancelVerification: vi.fn()
  }
}))

function createStubs() {
  return {
    'van-dialog': {
      name: 'VanDialog',
      template: '<div class="van-dialog-stub"><slot /></div>',
      props: {
        show: { type: Boolean, default: false },
        modelValue: { type: Boolean, default: false }
      }
    },
    'van-button': {
      name: 'VanButton',
      template: '<button class="van-button-stub" @click="$emit(\'click\')"><slot /></button>',
      props: ['to', 'block', 'plain', 'size', 'type'],
      emits: ['click']
    },
    'van-loading': {
      name: 'VanLoading',
      template: '<div class="van-loading-stub"><slot /></div>'
    },
    'van-icon': {
      name: 'VanIcon',
      template: '<span class="van-icon-stub"><slot /></span>',
      props: ['name', 'size', 'color']
    }
  }
}

function createWrapper(props = {}) {
  return mount(MobileDeviceVerifyDialog, {
    props: {
      modelValue: true,
      userId: '@user:localhost',
      deviceId: 'DEVICE1',
      ...props
    },
    global: {
      stubs: createStubs(),
      mocks: { $t: (key: string) => key }
    }
  })
}

describe('MobileDeviceVerifyDialog', () => {
  beforeEach(() => {
    mockStep.value = 'intro'
    mockEmojis.value = []
    mockPendingRequests.value = []
    mockErrorMessage.value = null
    vi.clearAllMocks()
  })

  it('renders intro state with three action buttons', () => {
    const wrapper = createWrapper()
    expect(wrapper.find('.van-dialog-stub').exists()).toBe(true)
    expect(wrapper.text()).toContain('verification.methods.sas')
    expect(wrapper.text()).toContain('verification.methods.qr_show')
    expect(wrapper.text()).toContain('verification.methods.qr_scan')
  })

  it('accepts userId and deviceId props', () => {
    const wrapper = createWrapper({ userId: '@test:server', deviceId: 'TESTDEV' })
    expect(wrapper.props('userId')).toBe('@test:server')
    expect(wrapper.props('deviceId')).toBe('TESTDEV')
  })

  it('calls startSas when SAS verification button is clicked', async () => {
    const wrapper = createWrapper()
    const buttons = wrapper.findAll('.van-button-stub')
    // First button is the SAS verification button
    await buttons[0].trigger('click')
    expect(mockStartSas).toHaveBeenCalled()
  })

  it('transitions to showKey state and displays emoji grid', () => {
    mockStep.value = 'showKey'
    mockEmojis.value = [
      { emoji: '🐶', description: 'Dog' },
      { emoji: '🐱', description: 'Cat' }
    ]
    const wrapper = createWrapper()
    expect(wrapper.text()).toContain('verification.sas.match')
    expect(wrapper.text()).toContain('verification.sas.mismatch')
    expect(wrapper.text()).toContain('Dog')
    expect(wrapper.text()).toContain('Cat')
  })

  it('emits verified event when match button is clicked', async () => {
    mockStep.value = 'showKey'
    const wrapper = createWrapper()
    // Find the "Match" button (primary type) and click it
    const buttons = wrapper.findAll('.van-button-stub')
    const matchButton = buttons.find((b) => b.text().includes('verification.sas.match'))
    expect(matchButton).toBeTruthy()
    await matchButton!.trigger('click')
    expect(wrapper.emitted('verified')).toBeTruthy()
    expect(mockConfirmSas).toHaveBeenCalledWith(true)
  })

  it('calls confirmSas(false) when mismatch button is clicked', async () => {
    mockStep.value = 'showKey'
    const wrapper = createWrapper()
    const buttons = wrapper.findAll('.van-button-stub')
    const mismatchButton = buttons.find((b) => b.text().includes('verification.sas.mismatch'))
    expect(mismatchButton).toBeTruthy()
    await mismatchButton!.trigger('click')
    expect(mockConfirmSas).toHaveBeenCalledWith(false)
  })

  it('renders pending state with loading spinner', () => {
    mockStep.value = 'pending'
    const wrapper = createWrapper()
    expect(wrapper.text()).toContain('verification.sas.waiting')
    expect(wrapper.find('.van-loading-stub').exists()).toBe(true)
  })

  it('renders failed state with warning icon and error message', () => {
    mockStep.value = 'failed'
    mockErrorMessage.value = 'Something went wrong'
    const wrapper = createWrapper()
    expect(wrapper.text()).toContain('Something went wrong')
  })

  it('renders cancelled state with fallback error text', () => {
    mockStep.value = 'cancelled'
    const wrapper = createWrapper()
    expect(wrapper.text()).toContain('verification.result.failed_desc')
  })

  it('renders success state', () => {
    mockStep.value = 'success'
    const wrapper = createWrapper()
    expect(wrapper.text()).toContain('verification.result.success_desc')
  })

  it('renders QR show placeholder with unavailable notice', () => {
    mockStep.value = 'showQr'
    const wrapper = createWrapper()
    expect(wrapper.text()).toContain('verification.qr.show_desc')
    expect(wrapper.text()).toContain('verification.qr.show_unavailable')
  })

  it('renders QR scan placeholder with unavailable notice', () => {
    mockStep.value = 'scanQr'
    const wrapper = createWrapper()
    expect(wrapper.text()).toContain('verification.qr.scan_desc')
    expect(wrapper.text()).toContain('verification.qr.scan_unavailable')
  })

  it('renders pending requests when list is non-empty', () => {
    mockStep.value = 'intro'
    mockPendingRequests.value = [
      { transactionId: 'txn1', userId: '@alice:localhost', deviceId: 'DEV', methods: ['m.sas.v1'], timestamp: 1 }
    ]
    const wrapper = createWrapper()
    expect(wrapper.text()).toContain('verification.pending_requests.title')
    expect(wrapper.text()).toContain('@alice:localhost')
    expect(wrapper.text()).toContain('verification.actions.reject')
    expect(wrapper.text()).toContain('verification.actions.accept')
  })
})
