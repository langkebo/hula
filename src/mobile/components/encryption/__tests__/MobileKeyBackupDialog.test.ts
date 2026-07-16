import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import MobileKeyBackupDialog from '../MobileKeyBackupDialog.vue'

// Shared reactive state for the composable mock
const mockStep = ref<string>('intro')
const mockLoading = ref(false)
const mockRecoveryKey = ref('')
const mockErrorMessage = ref<string | null>(null)
const mockPassphrase = ref('')
const mockCreateBackup = vi.fn()
const mockConfirmKeySaved = vi.fn()
const mockVerifyBackup = vi.fn()
const mockImportFromRecoveryKey = vi.fn()
const mockReset = vi.fn()

vi.mock('@/composables/encryption/useKeyBackupFlow', () => ({
  KeyBackupStep: { SUCCESS: 'success', ERROR: 'error' },
  KeyBackupMode: { SETUP: 'setup', RESTORE: 'restore' },
  useKeyBackupFlow: () => ({
    step: mockStep,
    loading: mockLoading,
    recoveryKey: mockRecoveryKey,
    errorMessage: mockErrorMessage,
    passphrase: mockPassphrase,
    isFinished: ref(false),
    createBackup: mockCreateBackup,
    confirmKeySaved: mockConfirmKeySaved,
    verifyBackup: mockVerifyBackup,
    importFromRecoveryKey: mockImportFromRecoveryKey,
    reset: mockReset
  })
}))

vi.mock('@/services/matrix/crypto/MatrixKeyBackupService', () => ({
  matrixKeyBackupService: {}
}))

function createStubs() {
  return {
    'van-dialog': {
      name: 'VanDialog',
      template: '<div class="van-dialog-stub"><slot /></div>',
      props: { show: { type: Boolean, default: false }, modelValue: { type: Boolean, default: false } }
    },
    'van-button': {
      name: 'VanButton',
      template: '<button class="van-button-stub" @click="$emit(\'click\')"><slot /></button>',
      props: ['to', 'block', 'plain', 'size', 'type'],
      emits: ['click']
    },
    'van-field': {
      name: 'VanField',
      template: '<div class="van-field-stub" data-test="van-field"><slot /></div>',
      props: ['modelValue', 'label', 'placeholder', 'type', 'rows']
    },
    'van-loading': {
      name: 'VanLoading',
      template: '<div class="van-loading-stub"><slot /></div>'
    },
    'van-icon': {
      name: 'VanIcon',
      template: '<span class="van-icon-stub"><slot /></span>',
      props: ['name', 'size', 'color']
    },
    'van-notice-bar': {
      name: 'VanNoticeBar',
      template: '<div class="van-notice-bar-stub">{{ text }}</div>',
      props: ['text', 'type']
    }
  }
}

function createWrapper(props = {}) {
  return mount(MobileKeyBackupDialog, {
    props: {
      modelValue: true,
      mode: 'setup',
      ...props
    },
    global: {
      stubs: createStubs(),
      mocks: { $t: (key: string) => key }
    }
  })
}

describe('MobileKeyBackupDialog', () => {
  beforeEach(() => {
    mockStep.value = 'intro'
    mockLoading.value = false
    mockRecoveryKey.value = ''
    mockErrorMessage.value = null
    mockPassphrase.value = ''
    vi.clearAllMocks()
  })

  it('renders setup mode with passphrase input', () => {
    const wrapper = createWrapper({ mode: 'setup' })
    expect(wrapper.find('.van-dialog-stub').exists()).toBe(true)
    expect(wrapper.find('[data-test="setup-passphrase"]').exists()).toBe(true)
  })

  it('renders restore mode with recovery key input', () => {
    const wrapper = createWrapper({ mode: 'restore' })
    expect(wrapper.find('[data-test="restore-input"]').exists()).toBe(true)
  })

  it('shows success and warning notices in showKey step', () => {
    mockStep.value = 'showKey'
    const wrapper = createWrapper({ mode: 'setup' })
    expect(wrapper.text()).toContain('encryption.keyBackup.setupComplete')
    expect(wrapper.text()).toContain('encryption.backup.recovery_key_desc')
    expect(wrapper.find('[data-test="setup-showkey"]').exists()).toBe(true)
  })

  it('shows loading spinner in verify step', () => {
    mockStep.value = 'verify'
    const wrapper = createWrapper({ mode: 'setup' })
    expect(wrapper.find('.van-loading-stub').exists()).toBe(true)
    expect(wrapper.text()).toContain('encryption.backup.verify_backup')
  })

  it('shows success state with done button', () => {
    mockStep.value = 'success'
    const wrapper = createWrapper({ mode: 'setup' })
    expect(wrapper.text()).toContain('encryption.keyBackup.setupComplete')
    expect(wrapper.text()).toContain('common.done')
  })

  it('shows error state with error message and close button', () => {
    mockStep.value = 'error'
    mockErrorMessage.value = 'Something went wrong'
    const wrapper = createWrapper({ mode: 'setup' })
    expect(wrapper.text()).toContain('Something went wrong')
    expect(wrapper.text()).toContain('common.close')
  })

  it('shows fallback text when errorMessage is null', () => {
    mockStep.value = 'error'
    const wrapper = createWrapper({ mode: 'setup' })
    expect(wrapper.text()).toContain('encryption.backup.failed_desc')
  })

  it('calls createBackup when generate button is clicked', async () => {
    const wrapper = createWrapper({ mode: 'setup' })
    const buttons = wrapper.findAll('.van-button-stub')
    await buttons[0].trigger('click')
    expect(mockCreateBackup).toHaveBeenCalledTimes(1)
  })

  it('calls confirmKeySaved and verifyBackup when confirm saved is clicked', async () => {
    mockStep.value = 'showKey'
    mockVerifyBackup.mockResolvedValue(true)
    const wrapper = createWrapper({ mode: 'setup' })
    const buttons = wrapper.findAll('.van-button-stub')
    // The last primary button is the "I've saved it" button
    const confirmButton = buttons[buttons.length - 1]
    await confirmButton.trigger('click')
    expect(mockConfirmKeySaved).toHaveBeenCalledTimes(1)
    expect(mockVerifyBackup).toHaveBeenCalledTimes(1)
  })

  it('calls importFromRecoveryKey when restore button is clicked', async () => {
    mockImportFromRecoveryKey.mockResolvedValue(true)
    const wrapper = createWrapper({ mode: 'restore' })
    ;(wrapper.vm as any).recoveryKeyInput = 'RECOVERY-KEY-123'
    const buttons = wrapper.findAll('.van-button-stub')
    await buttons[buttons.length - 1].trigger('click')
    expect(mockImportFromRecoveryKey).toHaveBeenCalledWith('RECOVERY-KEY-123')
  })

  it('emits complete on successful setup', async () => {
    mockStep.value = 'showKey'
    mockConfirmKeySaved.mockResolvedValue(undefined)
    mockVerifyBackup.mockImplementation(() => {
      mockStep.value = 'success'
      return Promise.resolve(true)
    })
    const wrapper = createWrapper({ mode: 'setup' })
    const buttons = wrapper.findAll('.van-button-stub')
    await buttons[buttons.length - 1].trigger('click')
    expect(wrapper.emitted('complete')).toBeTruthy()
  })

  it('emits complete on successful restore', async () => {
    mockImportFromRecoveryKey.mockImplementation(() => {
      mockStep.value = 'success'
      return Promise.resolve(true)
    })
    const wrapper = createWrapper({ mode: 'restore' })
    ;(wrapper.vm as any).recoveryKeyInput = 'RECOVERY-KEY-123'
    const buttons = wrapper.findAll('.van-button-stub')
    await buttons[buttons.length - 1].trigger('click')
    expect(wrapper.emitted('complete')).toBeTruthy()
  })
})
