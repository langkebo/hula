import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Ref } from 'vue'
import MobileSecureBackupDialog from '../MobileSecureBackupDialog.vue'

const mockCreateSecureBackup = vi.hoisted(() => vi.fn().mockResolvedValue(true))
const mockRestoreFromSecureBackup = vi.hoisted(() => vi.fn().mockResolvedValue(true))
const mockReset = vi.hoisted(() => vi.fn())
const mockRefs = vi.hoisted(() => ({}) as Record<string, Ref<any>>)

vi.mock('@/composables/encryption/useSecureBackupFlow', async () => {
  const { ref, computed } = await import('vue')
  mockRefs.phase = ref('status')
  mockRefs.loading = ref(false)
  mockRefs.errorMessage = ref<string | null>(null)
  mockRefs.passphrase = ref('')
  const isActive = computed(() => false)
  return {
    useSecureBackupFlow: () => ({
      phase: mockRefs.phase,
      loading: mockRefs.loading,
      errorMessage: mockRefs.errorMessage,
      passphrase: mockRefs.passphrase,
      isActive,
      createSecureBackup: mockCreateSecureBackup,
      restoreFromSecureBackup: mockRestoreFromSecureBackup,
      reset: mockReset
    })
  }
})

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key })
}))

const dialogStub = {
  props: ['show'],
  template: '<div data-test="van-dialog" v-if="show"><slot /></div>'
}

function createWrapper() {
  return mount(MobileSecureBackupDialog, {
    props: { modelValue: true },
    global: {
      stubs: {
        'van-dialog': dialogStub,
        'van-field': { template: '<div class="van-field"><slot /></div>' },
        'van-button': { template: '<button><slot /></button>' },
        'van-loading': { template: '<div class="van-loading" />' },
        'van-icon': { template: '<i class="van-icon" />' }
      }
    }
  })
}

describe('MobileSecureBackupDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRefs.phase.value = 'status'
    mockRefs.loading.value = false
    mockRefs.errorMessage.value = null
  })

  it('renders IDLE state with create and restore buttons', () => {
    const wrapper = createWrapper()
    expect(wrapper.text()).toContain('mobile_security.secure_backup.create')
    expect(wrapper.text()).toContain('mobile_security.secure_backup.restore')
  })

  it('renders creating loading state when phase is create', async () => {
    const wrapper = createWrapper()
    mockRefs.phase.value = 'create'
    await wrapper.vm.$nextTick()
    expect(wrapper.text()).toContain('mobile_security.secure_backup.generating')
  })

  it('renders restoring loading state when phase is restore', async () => {
    const wrapper = createWrapper()
    mockRefs.phase.value = 'restore'
    await wrapper.vm.$nextTick()
    expect(wrapper.text()).toContain('mobile_security.secure_backup.restoring')
  })

  it('renders error state with retry button when phase is error', async () => {
    const wrapper = createWrapper()
    mockRefs.phase.value = 'error'
    await wrapper.vm.$nextTick()
    expect(wrapper.text()).toContain('common.retry')
  })

  it('renders success state with done button when phase is success', async () => {
    const wrapper = createWrapper()
    mockRefs.phase.value = 'success'
    await wrapper.vm.$nextTick()
    expect(wrapper.text()).toContain('common.done')
  })

  it('calls createSecureBackup when create confirm button is clicked', async () => {
    const wrapper = createWrapper()

    // Click create button in menu to enter create-input step
    const buttons = wrapper.findAll('button')
    await buttons[0].trigger('click')

    // Now in create-input mode — click the confirm create button
    const confirmButtons = wrapper.findAll('button')
    await confirmButtons[0].trigger('click')

    expect(mockCreateSecureBackup).toHaveBeenCalledTimes(1)
  })

  it('calls restoreFromSecureBackup when restore confirm button is clicked', async () => {
    const wrapper = createWrapper()

    // Click restore button in menu to enter restore-input step
    const buttons = wrapper.findAll('button')
    await buttons[1].trigger('click')

    // Now in restore-input mode — click the confirm restore button
    const confirmButtons = wrapper.findAll('button')
    await confirmButtons[0].trigger('click')

    expect(mockRestoreFromSecureBackup).toHaveBeenCalled()
  })

  it('calls reset when dialog is opened (modelValue becomes true)', async () => {
    const wrapper = createWrapper()

    // Reset mock after initial mount
    mockReset.mockClear()

    // Toggle dialog open/close
    await wrapper.setProps({ modelValue: false })
    await wrapper.vm.$nextTick()
    await wrapper.setProps({ modelValue: true })
    await wrapper.vm.$nextTick()

    // The watch on visible should call reset() when dialog opens
    expect(mockReset).toHaveBeenCalled()
  })
})
