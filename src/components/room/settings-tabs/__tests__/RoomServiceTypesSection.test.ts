import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import RoomServiceTypesSection from '../RoomServiceTypesSection.vue'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key })
}))

const mocks = vi.hoisted(() => ({
  getRoomServiceTypes: vi.fn()
}))

vi.mock('@/services/matrix/room/RoomFacade', () => ({
  matrixRoomReadFacade: { getRoomServiceTypes: mocks.getRoomServiceTypes }
}))

const naiveStubs = {
  Spin: { template: '<div class="n-spin" data-testid="service-types-loading" />', props: ['size'] },
  Button: {
    template: '<button class="n-button" @click="$emit(\'click\')"><slot /></button>',
    props: ['size', 'type', 'loading'],
    emits: ['click']
  }
}

const mountSection = async (roomId = '!room:hs') => {
  const wrapper = mount(RoomServiceTypesSection, {
    props: { roomId },
    global: { stubs: naiveStubs }
  })
  await flushPromises()
  return wrapper
}

describe('RoomServiceTypesSection — 房间服务类型只读区块', () => {
  beforeEach(() => {
    mocks.getRoomServiceTypes.mockReset()
  })

  it('挂载时按 roomId 读取服务类型', async () => {
    mocks.getRoomServiceTypes.mockResolvedValue({ status: 'ok', serviceTypes: ['messaging'] })
    await mountSection()

    expect(mocks.getRoomServiceTypes).toHaveBeenCalledWith('!room:hs')
  })

  it('已知服务类型映射为本地文案，未知类型原样展示', async () => {
    mocks.getRoomServiceTypes.mockResolvedValue({
      status: 'ok',
      serviceTypes: ['messaging', 'encryption', 'directory', 'custom.widget']
    })
    const wrapper = await mountSection()

    const items = wrapper.findAll('[data-testid="service-types-item"]')
    expect(items.map((item) => item.text())).toEqual([
      'room.settings_drawer.service_type_messaging',
      'room.settings_drawer.service_type_encryption',
      'room.settings_drawer.service_type_directory',
      'custom.widget'
    ])
  })

  it('空态展示空提示而不伪装成列表', async () => {
    mocks.getRoomServiceTypes.mockResolvedValue({ status: 'empty' })
    const wrapper = await mountSection()

    expect(wrapper.find('[data-testid="service-types-empty"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="service-types-item"]').exists()).toBe(false)
  })

  it('服务器不支持时展示 unsupported 提示', async () => {
    mocks.getRoomServiceTypes.mockResolvedValue({ status: 'unsupported' })
    const wrapper = await mountSection()

    expect(wrapper.find('[data-testid="service-types-unsupported"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="service-types-empty"]').exists()).toBe(false)
  })

  it('读取失败时展示失败与重试，重试成功后渲染列表', async () => {
    mocks.getRoomServiceTypes.mockResolvedValueOnce({ status: 'error' })
    const wrapper = await mountSection()

    expect(wrapper.find('[data-testid="service-types-error"]').exists()).toBe(true)

    mocks.getRoomServiceTypes.mockResolvedValue({ status: 'ok', serviceTypes: ['messaging'] })
    await wrapper.find('[data-testid="service-types-retry"]').trigger('click')
    await flushPromises()

    expect(wrapper.find('[data-testid="service-types-error"]').exists()).toBe(false)
    expect(wrapper.findAll('[data-testid="service-types-item"]')).toHaveLength(1)
  })

  it('roomId 变化时重新读取', async () => {
    mocks.getRoomServiceTypes.mockResolvedValue({ status: 'empty' })
    const wrapper = await mountSection()

    mocks.getRoomServiceTypes.mockResolvedValue({ status: 'ok', serviceTypes: ['messaging'] })
    await wrapper.setProps({ roomId: '!other:hs' })
    await flushPromises()

    expect(mocks.getRoomServiceTypes).toHaveBeenLastCalledWith('!other:hs')
    expect(wrapper.findAll('[data-testid="service-types-item"]')).toHaveLength(1)
  })
})
