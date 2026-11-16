import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import MyRoomsDialog from '../MyRoomsDialog.vue'

const { getMyRoomsMock, loggerErrorMock } = vi.hoisted(() => ({
  getMyRoomsMock: vi.fn(),
  loggerErrorMock: vi.fn()
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key
  })
}))

vi.mock('@/services/matrix/user/MatrixAccountService', () => ({
  matrixAccountService: {
    getMyRooms: getMyRoomsMock
  }
}))

vi.mock('@/utils/Logger', () => ({
  createLogger: () => ({
    error: loggerErrorMock
  })
}))

const mountDialog = (show = true) =>
  mount(MyRoomsDialog, {
    props: { show },
    global: {
      stubs: {
        BaseRightDrawer: {
          name: 'BaseRightDrawer',
          props: ['show', 'title'],
          emits: ['update:show'],
          template: '<div><slot name="header-extra" /><slot /></div>'
        }
      }
    }
  })

const room = (roomId: string, membership: string, name?: string) => ({
  roomId,
  name,
  avatarUrl: undefined,
  membership
})

describe('MyRoomsDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getMyRoomsMock.mockResolvedValue([])
  })

  it('loads rooms on open and renders groups by membership, hiding empty groups', async () => {
    getMyRoomsMock.mockResolvedValue([
      room('!join1:server', 'join', 'Join One'),
      room('!join2:server', 'join', 'Join Two'),
      room('!invite1:server', 'invite', 'Invite One')
    ])

    const wrapper = mountDialog()
    await flushPromises()

    expect(getMyRoomsMock).toHaveBeenCalledTimes(1)
    expect(wrapper.find('[data-test="my-rooms-group-join"]').exists()).toBe(true)
    expect(wrapper.find('[data-test="my-rooms-group-invite"]').exists()).toBe(true)
    expect(wrapper.find('[data-test="my-rooms-group-leave"]').exists()).toBe(false)
    expect(wrapper.findAll('[data-test="my-rooms-item"]')).toHaveLength(3)
  })

  it('treats unknown membership values as joined', async () => {
    getMyRoomsMock.mockResolvedValue([room('!knock:server', 'knock', 'Knock Room')])

    const wrapper = mountDialog()
    await flushPromises()

    expect(wrapper.find('[data-test="my-rooms-group-join"]').exists()).toBe(true)
    expect(wrapper.find('[data-test="my-rooms-group-invite"]').exists()).toBe(false)
  })

  it('filters rooms locally by name and room id', async () => {
    getMyRoomsMock.mockResolvedValue([
      room('!alpha:server', 'join', 'Alpha Room'),
      room('!beta:server', 'leave', 'Beta Room')
    ])

    const wrapper = mountDialog()
    await flushPromises()

    await wrapper.find('[data-test="my-rooms-search"]').setValue('alpha')
    expect(wrapper.findAll('[data-test="my-rooms-item"]')).toHaveLength(1)
    expect(wrapper.text()).toContain('Alpha Room')

    await wrapper.find('[data-test="my-rooms-search"]').setValue('!beta')
    expect(wrapper.findAll('[data-test="my-rooms-item"]')).toHaveLength(1)
    expect(wrapper.text()).toContain('Beta Room')
  })

  it('shows the loading state while the request is pending', async () => {
    let resolveRooms: (value: unknown[]) => void = () => {}
    getMyRoomsMock.mockReturnValue(
      new Promise<unknown[]>((resolve) => {
        resolveRooms = resolve
      })
    )

    const wrapper = mountDialog()
    await flushPromises()

    expect(wrapper.find('[data-test="my-rooms-loading"]').exists()).toBe(true)

    resolveRooms([])
    await flushPromises()
    expect(wrapper.find('[data-test="my-rooms-empty"]').exists()).toBe(true)
  })

  it('shows the error state and retries the request', async () => {
    getMyRoomsMock
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce([{ roomId: '!room1:server', name: 'Room 1', avatarUrl: undefined, membership: 'join' }])

    const wrapper = mountDialog()
    await flushPromises()

    expect(wrapper.find('[data-test="my-rooms-error"]').exists()).toBe(true)
    expect(loggerErrorMock).toHaveBeenCalledTimes(1)

    await wrapper.find('[data-test="my-rooms-retry"]').trigger('click')
    await flushPromises()

    expect(getMyRoomsMock).toHaveBeenCalledTimes(2)
    expect(wrapper.find('[data-test="my-rooms-error"]').exists()).toBe(false)
    expect(wrapper.findAll('[data-test="my-rooms-item"]')).toHaveLength(1)
  })

  it('emits open-room with the room id when a room is clicked', async () => {
    getMyRoomsMock.mockResolvedValue([room('!room1:server', 'join', 'Room 1')])

    const wrapper = mountDialog()
    await flushPromises()

    await wrapper.find('[data-test="my-rooms-item"]').trigger('click')

    expect(wrapper.emitted('open-room')?.[0]).toEqual(['!room1:server'])
  })

  it('reloads when reopened through the show prop', async () => {
    const wrapper = mountDialog(false)
    await flushPromises()
    expect(getMyRoomsMock).not.toHaveBeenCalled()

    await wrapper.setProps({ show: true })
    await flushPromises()
    expect(getMyRoomsMock).toHaveBeenCalledTimes(1)

    await wrapper.find('[data-test="my-rooms-refresh"]').trigger('click')
    await flushPromises()
    expect(getMyRoomsMock).toHaveBeenCalledTimes(2)
  })

  it('forwards drawer close events through update:show', async () => {
    const wrapper = mountDialog()
    await flushPromises()

    wrapper.findComponent({ name: 'BaseRightDrawer' }).vm.$emit('update:show', false)

    expect(wrapper.emitted('update:show')?.[0]).toEqual([false])
  })
})
