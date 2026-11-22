import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { makeMutualRoomsResult } from '@/services/matrix/user/__tests__/fixtures/relationship'
import { createI18nMock, resolveMessage } from '~/tests/i18n-messages'
import MutualRoomsSection from '../MutualRoomsSection.vue'

const capabilityState = vi.hoisted(() => ({ available: true }))
const getUserIdMock = vi.hoisted(() => vi.fn(() => '@me:matrix.test'))
const getMutualRoomsMock = vi.hoisted(() => vi.fn())
const rooms = vi.hoisted(
  () =>
    new Map([
      ['!a:matrix.test', { name: 'Alpha Room', avatarUrl: '' }],
      ['!b:matrix.test', { name: 'Beta Room', avatarUrl: '' }]
    ])
)

vi.mock('vue-i18n', () => createI18nMock())

vi.mock('@/services/matrix/MatrixCapabilityService', () => ({
  useServerCapability: () => ({
    isCapabilityAvailable: (capability: string) => capabilityState.available && capability === 'mutual-rooms'
  })
}))

vi.mock('@/services/matrix/MatrixClientService', () => ({
  matrixClientService: {
    getUserId: getUserIdMock
  }
}))

vi.mock('@/services/matrix/user/MatrixRelationshipService', () => ({
  matrixRelationshipService: {
    getMutualRooms: getMutualRoomsMock
  }
}))

vi.mock('@/stores/domains/chat/room', () => ({
  useRoomStore: () => ({ rooms })
}))

vi.mock('@/utils/AvatarUtils', () => ({
  AvatarUtils: { getAvatarUrl: (url: string) => `resolved:${url}` }
}))

vi.mock('@/utils/Logger', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() })
}))

const globalStubs = {
  NAvatar: {
    props: ['src', 'size', 'round'],
    template: '<span class="n-avatar-stub" :data-src="src" />'
  },
  NButton: {
    props: ['text', 'size', 'loading'],
    emits: ['click'],
    template:
      '<button class="n-button-stub" :data-loading="String(loading)" @click="$emit(\'click\')"><slot /></button>'
  }
}

const mountSection = (userId = '@alice:matrix.test') =>
  mount(MutualRoomsSection, {
    props: { userId },
    global: { stubs: globalStubs }
  })

describe('MutualRoomsSection', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    capabilityState.available = true
    getUserIdMock.mockReturnValue('@me:matrix.test')
    getMutualRoomsMock.mockResolvedValue({ roomIds: [] })
  })

  it('能力不可用时不渲染且不请求', async () => {
    capabilityState.available = false
    const wrapper = mountSection()
    await flushPromises()

    expect(wrapper.find('[data-testid="mutual-rooms-section"]').exists()).toBe(false)
    expect(getMutualRoomsMock).not.toHaveBeenCalled()
  })

  it('对方是自己时不渲染且不请求（避免 403）', async () => {
    getUserIdMock.mockReturnValue('@alice:matrix.test')
    const wrapper = mountSection('@alice:matrix.test')
    await flushPromises()

    expect(wrapper.find('[data-testid="mutual-rooms-section"]').exists()).toBe(false)
    expect(getMutualRoomsMock).not.toHaveBeenCalled()
  })

  it('加载中展示 loading 文案', async () => {
    let resolveRequest: (value: { roomIds: string[] }) => void = () => {}
    getMutualRoomsMock.mockReturnValue(
      new Promise((resolve) => {
        resolveRequest = resolve
      })
    )

    const wrapper = mountSection()
    await flushPromises()

    expect(wrapper.text()).toContain(resolveMessage('friend.detail.mutual_rooms_loading'))
    expect(getMutualRoomsMock).toHaveBeenCalledWith('@alice:matrix.test', 20, undefined)

    resolveRequest({ roomIds: [] })
    await flushPromises()
  })

  it('成功时按 room store 解析名称并支持点击打开房间', async () => {
    getMutualRoomsMock.mockResolvedValue({ roomIds: ['!a:matrix.test', '!b:matrix.test'] })
    const wrapper = mountSection()
    await flushPromises()

    const items = wrapper.findAll('[data-testid="mutual-rooms-item"]')
    expect(items).toHaveLength(2)
    expect(wrapper.text()).toContain('Alpha Room')
    expect(wrapper.text()).toContain('Beta Room')

    await items[0].trigger('click')
    expect(wrapper.emitted('open-room')).toEqual([['!a:matrix.test']])
  })

  it('未知房间回退为「未命名房间」', async () => {
    getMutualRoomsMock.mockResolvedValue({ roomIds: ['!unknown:matrix.test'] })
    const wrapper = mountSection()
    await flushPromises()

    expect(wrapper.text()).toContain(resolveMessage('friend.detail.mutual_rooms_untitled'))
  })

  it('空列表展示空态', async () => {
    const wrapper = mountSection()
    await flushPromises()

    expect(wrapper.find('[data-testid="mutual-rooms-empty"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="mutual-rooms-empty"]').text()).toContain(
      resolveMessage('friend.detail.mutual_rooms_empty')
    )
  })

  it('失败展示错误态，重试后恢复列表', async () => {
    getMutualRoomsMock.mockRejectedValueOnce(new Error('network down'))
    const wrapper = mountSection()
    await flushPromises()

    const errorBlock = wrapper.find('[data-testid="mutual-rooms-error"]')
    expect(errorBlock.exists()).toBe(true)
    expect(errorBlock.text()).toContain(resolveMessage('friend.detail.mutual_rooms_load_error'))

    getMutualRoomsMock.mockResolvedValueOnce(makeMutualRoomsResult({ roomIds: ['!a:matrix.test'] }))
    await errorBlock.find('button').trigger('click')
    await flushPromises()

    expect(getMutualRoomsMock).toHaveBeenCalledTimes(2)
    expect(wrapper.findAll('[data-testid="mutual-rooms-item"]')).toHaveLength(1)
  })

  it('存在 next_batch_token 时加载更多并去重追加', async () => {
    getMutualRoomsMock
      .mockResolvedValueOnce(makeMutualRoomsResult({ roomIds: ['!a:matrix.test'], nextBatchToken: 'token-2' }))
      .mockResolvedValueOnce(makeMutualRoomsResult({ roomIds: ['!a:matrix.test', '!b:matrix.test'] }))

    const wrapper = mountSection()
    await flushPromises()

    const loadMore = wrapper.find('[data-testid="mutual-rooms-load-more"]')
    expect(loadMore.exists()).toBe(true)

    await loadMore.trigger('click')
    await flushPromises()

    expect(getMutualRoomsMock).toHaveBeenLastCalledWith('@alice:matrix.test', 20, 'token-2')
    expect(wrapper.findAll('[data-testid="mutual-rooms-item"]')).toHaveLength(2)
  })
})
