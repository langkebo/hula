import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Ref } from 'vue'
import MobileDehydratedDeviceDialog from '../MobileDehydratedDeviceDialog.vue'

const mockLoadDehydratedDevices = vi.hoisted(() => vi.fn().mockResolvedValue([]))
const mockCreateDehydratedDevice = vi.hoisted(() => vi.fn().mockResolvedValue(undefined))
const mockDeleteDehydratedDevice = vi.hoisted(() => vi.fn().mockResolvedValue(true))
const mockRefs = vi.hoisted(() => ({}) as Record<string, Ref<any>>)

vi.mock('@/composables/encryption/useDehydratedDevice', async () => {
  const { ref } = await import('vue')
  mockRefs.devices = ref([])
  mockRefs.loading = ref(false)
  return {
    useDehydratedDevice: () => ({
      devices: mockRefs.devices,
      loading: mockRefs.loading,
      loadDehydratedDevices: mockLoadDehydratedDevices,
      createDehydratedDevice: mockCreateDehydratedDevice,
      claimDehydratedDevice: vi.fn(),
      deleteDehydratedDevice: mockDeleteDehydratedDevice,
      getDehydratedDeviceKey: vi.fn()
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

const renderCellStub = {
  props: ['title', 'label'],
  template: '<div class="van-cell">{{ title }} {{ label }} <slot name="right-icon" /></div>'
}

function createWrapper() {
  return mount(MobileDehydratedDeviceDialog, {
    props: { show: true },
    global: {
      stubs: {
        'van-dialog': dialogStub,
        'van-button': { template: '<button><slot /></button>' },
        'van-cell-group': { template: '<div class="van-cell-group"><slot /></div>' },
        'van-cell': renderCellStub,
        'van-loading': { template: '<div class="van-loading" />' }
      }
    }
  })
}

describe('MobileDehydratedDeviceDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRefs.devices.value = []
    mockRefs.loading.value = false
  })

  it('renders the dialog with description', () => {
    const wrapper = createWrapper()
    expect(wrapper.text()).toContain('mobile_encryption.dehydrated_device.description')
  })

  it('shows empty state when no devices', () => {
    const wrapper = createWrapper()
    expect(wrapper.text()).toContain('mobile_encryption.dehydrated_device.no_devices')
  })

  it('shows create button', () => {
    const wrapper = createWrapper()
    expect(wrapper.text()).toContain('mobile_encryption.dehydrated_device.create')
  })

  it('renders device list when devices exist', () => {
    mockRefs.devices.value = [{ deviceId: 'DEADBEEF' }]
    const wrapper = createWrapper()
    expect(wrapper.text()).toContain('DEADBEEF')
  })

  it('does not show empty state when devices exist', () => {
    mockRefs.devices.value = [{ deviceId: 'DEADBEEF' }]
    const wrapper = createWrapper()
    expect(wrapper.text()).not.toContain('mobile_encryption.dehydrated_device.no_devices')
  })
})
