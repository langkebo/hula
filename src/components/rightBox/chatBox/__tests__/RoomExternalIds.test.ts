import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key
  })
}))

const { getRoomExternalIdsMock } = vi.hoisted(() => ({
  getRoomExternalIdsMock: vi.fn()
}))

vi.mock('@/services/matrix/room/RoomFacade', () => ({
  matrixRoomReadFacade: {
    getRoomExternalIds: getRoomExternalIdsMock
  }
}))

import RoomExternalIds from '../RoomExternalIds.vue'

const mountSection = (roomId = '!room:id') => mount(RoomExternalIds, { props: { roomId } })

describe('RoomExternalIds', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('有数据时按条目渲染，room_alias 使用本地化类型标签', async () => {
    getRoomExternalIdsMock.mockResolvedValue([{ type: 'room_alias', value: '#tjg:example.org' }])
    const wrapper = mountSection()
    await flushPromises()

    expect(getRoomExternalIdsMock).toHaveBeenCalledWith('!room:id')
    expect(wrapper.find('[data-testid="room-external-ids"]').exists()).toBe(true)
    expect(wrapper.findAll('[data-testid="room-external-id-row"]')).toHaveLength(1)
    expect(wrapper.text()).toContain('home.chat_sidebar.external_ids.type_room_alias')
    expect(wrapper.text()).toContain('#tjg:example.org')
  })

  it('空数组时整块不渲染，不留空占位', async () => {
    getRoomExternalIdsMock.mockResolvedValue([])
    const wrapper = mountSection()
    await flushPromises()

    expect(wrapper.find('[data-testid="room-external-ids"]').exists()).toBe(false)
  })

  it('切换房间后重新加载并替换列表', async () => {
    getRoomExternalIdsMock.mockResolvedValueOnce([{ type: 'room_alias', value: '#first:example.org' }])
    getRoomExternalIdsMock.mockResolvedValueOnce([{ type: 'room_alias', value: '#second:example.org' }])
    const wrapper = mountSection()
    await flushPromises()

    await wrapper.setProps({ roomId: '!room:two' })
    await flushPromises()

    expect(getRoomExternalIdsMock).toHaveBeenLastCalledWith('!room:two')
    expect(wrapper.text()).toContain('#second:example.org')
    expect(wrapper.text()).not.toContain('#first:example.org')
  })

  it('非 room_alias 类型原样展示类型值', async () => {
    getRoomExternalIdsMock.mockResolvedValue([{ type: 'custom_provider', value: 'custom-1' }])
    const wrapper = mountSection()
    await flushPromises()

    expect(wrapper.text()).toContain('custom_provider')
    expect(wrapper.text()).toContain('custom-1')
  })
})
