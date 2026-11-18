import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import RoomSpacesSection from '../RoomSpacesSection.vue'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key })
}))

const mocks = vi.hoisted(() => ({
  getRoomSpaces: vi.fn()
}))

vi.mock('@/services/matrix/room/RoomFacade', () => ({
  matrixRoomReadFacade: { getRoomSpaces: mocks.getRoomSpaces }
}))

const naiveStubs = {
  Spin: { template: '<div class="n-spin" data-testid="room-spaces-loading" />', props: ['size'] },
  Button: {
    template: '<button class="n-button" @click="$emit(\'click\')"><slot /></button>',
    props: ['size', 'type', 'loading'],
    emits: ['click']
  }
}

const mountSection = async (roomId = '!room:hs') => {
  const wrapper = mount(RoomSpacesSection, {
    props: { roomId },
    global: { stubs: naiveStubs }
  })
  await flushPromises()
  return wrapper
}

describe('RoomSpacesSection — 房间所属空间只读区块', () => {
  beforeEach(() => {
    mocks.getRoomSpaces.mockReset()
  })

  it('挂载时按 roomId 读取所属空间', async () => {
    mocks.getRoomSpaces.mockResolvedValue({ status: 'empty' })
    await mountSection()

    expect(mocks.getRoomSpaces).toHaveBeenCalledWith('!room:hs')
  })

  it('渲染空间名称与主别名', async () => {
    mocks.getRoomSpaces.mockResolvedValue({
      status: 'ok',
      spaces: [
        {
          roomId: '!s:hs',
          name: '产品空间',
          canonicalAlias: '#product:hs',
          avatarUrl: '',
          topic: ''
        }
      ]
    })
    const wrapper = await mountSection()

    const items = wrapper.findAll('[data-testid="room-spaces-item"]')
    expect(items).toHaveLength(1)
    expect(items[0].text()).toContain('产品空间')
    expect(items[0].text()).toContain('#product:hs')
  })

  it('空间缺少名称时回落为房间 ID', async () => {
    mocks.getRoomSpaces.mockResolvedValue({
      status: 'ok',
      spaces: [{ roomId: '!s:hs', name: '', canonicalAlias: '', avatarUrl: '', topic: '' }]
    })
    const wrapper = await mountSection()

    expect(wrapper.find('[data-testid="room-spaces-item"]').text()).toContain('!s:hs')
  })

  it('空态展示空提示而不伪装成列表', async () => {
    mocks.getRoomSpaces.mockResolvedValue({ status: 'empty' })
    const wrapper = await mountSection()

    expect(wrapper.find('[data-testid="room-spaces-empty"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="room-spaces-item"]').exists()).toBe(false)
  })

  it('服务器不支持时展示 unsupported 提示', async () => {
    mocks.getRoomSpaces.mockResolvedValue({ status: 'unsupported' })
    const wrapper = await mountSection()

    expect(wrapper.find('[data-testid="room-spaces-unsupported"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="room-spaces-empty"]').exists()).toBe(false)
  })

  it('读取失败时展示失败与重试，重试成功后渲染列表', async () => {
    mocks.getRoomSpaces.mockResolvedValueOnce({ status: 'error' })
    const wrapper = await mountSection()

    expect(wrapper.find('[data-testid="room-spaces-error"]').exists()).toBe(true)

    mocks.getRoomSpaces.mockResolvedValue({
      status: 'ok',
      spaces: [{ roomId: '!s:hs', name: '产品空间', canonicalAlias: '', avatarUrl: '', topic: '' }]
    })
    await wrapper.find('[data-testid="partial-retry"]').trigger('click')
    await flushPromises()

    expect(wrapper.find('[data-testid="room-spaces-error"]').exists()).toBe(false)
    expect(wrapper.findAll('[data-testid="room-spaces-item"]')).toHaveLength(1)
  })

  it('roomId 变化时重新读取', async () => {
    mocks.getRoomSpaces.mockResolvedValue({ status: 'empty' })
    const wrapper = await mountSection()

    mocks.getRoomSpaces.mockResolvedValue({
      status: 'ok',
      spaces: [{ roomId: '!s:hs', name: '产品空间', canonicalAlias: '', avatarUrl: '', topic: '' }]
    })
    await wrapper.setProps({ roomId: '!other:hs' })
    await flushPromises()

    expect(mocks.getRoomSpaces).toHaveBeenLastCalledWith('!other:hs')
    expect(wrapper.findAll('[data-testid="room-spaces-item"]')).toHaveLength(1)
  })
})
