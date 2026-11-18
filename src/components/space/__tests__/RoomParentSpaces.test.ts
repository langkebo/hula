import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import RoomParentSpaces from '../RoomParentSpaces.vue'

/**
 * 房间详情「所属空间」区块四态。
 *
 * 回归背景：读取失败曾被渲染成「不在任何空间中」，两者语义相反——
 * 用户会误以为该房间真的没有归属空间。
 */

const { getRoomParentSpacesMock, routerPushMock } = vi.hoisted(() => ({
  getRoomParentSpacesMock: vi.fn(),
  routerPushMock: vi.fn(() => Promise.resolve())
}))

vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }))
vi.mock('vue-router', () => ({ useRouter: () => ({ push: routerPushMock }) }))
vi.mock('@iconify/vue', () => ({ Icon: { name: 'Icon', template: '<i />' } }))
vi.mock('naive-ui', () => ({
  NSpin: { name: 'NSpin', template: '<div class="n-spin-stub"><slot /></div>' },
  NTag: { name: 'NTag', template: '<div class="n-tag-stub"><slot /></div>' }
}))
vi.mock('@/services/matrix/room/MatrixSpaceService', () => ({
  matrixSpaceService: {
    getRoomParentSpaces: (...args: unknown[]) => getRoomParentSpacesMock(...args)
  }
}))

const mountBlock = () => mount(RoomParentSpaces, { props: { roomId: '!room:server' } })

describe('RoomParentSpaces', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    routerPushMock.mockResolvedValue(undefined)
  })

  it('有归属空间时渲染空间标签', async () => {
    getRoomParentSpacesMock.mockResolvedValue([{ spaceId: '!space:server', name: 'Space A' }])

    const wrapper = mountBlock()
    await flushPromises()

    expect(wrapper.find('.parent-spaces-tags').exists()).toBe(true)
    expect(wrapper.text()).toContain('Space A')
    expect(wrapper.find('.parent-spaces-error').exists()).toBe(false)
  })

  it('读取失败时展示错误与重试，而不是「不在任何空间中」', async () => {
    getRoomParentSpacesMock.mockRejectedValue(new Error('network down'))

    const wrapper = mountBlock()
    await flushPromises()

    expect(wrapper.find('.parent-spaces-error').exists()).toBe(true)
    expect(wrapper.find('[data-testid="parent-spaces-retry"]').exists()).toBe(true)
    expect(wrapper.text()).not.toContain('room.detail.no_parent_spaces')
  })

  it('点击重试后重新拉取并渲染标签', async () => {
    getRoomParentSpacesMock.mockRejectedValueOnce(new Error('network down'))
    getRoomParentSpacesMock.mockResolvedValueOnce([{ spaceId: '!space:server', name: 'Space A' }])

    const wrapper = mountBlock()
    await flushPromises()
    expect(wrapper.find('.parent-spaces-error').exists()).toBe(true)

    await wrapper.find('[data-testid="parent-spaces-retry"]').trigger('click')
    await flushPromises()

    expect(getRoomParentSpacesMock).toHaveBeenCalledTimes(2)
    expect(wrapper.find('.parent-spaces-error').exists()).toBe(false)
    expect(wrapper.text()).toContain('Space A')
  })

  it('真正的空结果显示空态文案', async () => {
    getRoomParentSpacesMock.mockResolvedValue([])

    const wrapper = mountBlock()
    await flushPromises()

    expect(wrapper.find('.parent-spaces-empty').exists()).toBe(true)
    expect(wrapper.find('.parent-spaces-error').exists()).toBe(false)
  })
})
