import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import MobileDeviceVerifyDialog from '../MobileDeviceVerifyDialog.vue'

vi.mock('@/composables/encryption/useDeviceVerifyFlow', () => ({
  useDeviceVerifyFlow: () => ({
    step: ref('intro'),
    loading: ref(false),
    emojis: ref([]),
    pendingRequests: ref([]),
    errorMessage: ref(null),
    startSas: vi.fn(),
    confirmSas: vi.fn(),
    cancelVerification: vi.fn(),
    acceptVerification: vi.fn(),
    refreshPendingRequests: vi.fn(),
    reset: vi.fn()
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
      template: '<button class="van-button-stub"><slot /></button>',
      props: ['to', 'block', 'plain', 'size', 'type']
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

describe('MobileDeviceVerifyDialog', () => {
  it('renders IDLE state with three action buttons', () => {
    const wrapper = mount(MobileDeviceVerifyDialog, {
      props: { modelValue: true, userId: '@user:localhost', deviceId: 'DEVICE1' },
      global: {
        stubs: createStubs(),
        mocks: { $t: (key: string) => key }
      }
    })
    // Dialog container is rendered
    expect(wrapper.find('.van-dialog-stub').exists()).toBe(true)
    // Initial step is 'intro' which shows SAS, QR show, QR scan buttons
    expect(wrapper.text()).toContain('encryption.verify.sas')
    expect(wrapper.text()).toContain('encryption.verify.qrShow')
    expect(wrapper.text()).toContain('encryption.verify.qrScan')
  })

  it('accepts userId and deviceId props', () => {
    const wrapper = mount(MobileDeviceVerifyDialog, {
      props: { modelValue: true, userId: '@test:server', deviceId: 'TESTDEV' },
      global: {
        stubs: createStubs(),
        mocks: { $t: (key: string) => key }
      }
    })
    expect(wrapper.props('userId')).toBe('@test:server')
    expect(wrapper.props('deviceId')).toBe('TESTDEV')
  })
})
