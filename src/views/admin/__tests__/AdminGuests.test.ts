import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AdminGuests from '../AdminGuests.vue'

const { getUsersMock, getUserRoomsMock, deactivateUserMock, showFeedbackMock, warningMock } = vi.hoisted(() => ({
  getUsersMock: vi.fn(),
  getUserRoomsMock: vi.fn(),
  deactivateUserMock: vi.fn(),
  showFeedbackMock: vi.fn(),
  warningMock: vi.fn()
}))

vi.mock('@/services/matrix/admin', () => ({
  adminService: {
    getUsers: getUsersMock,
    getUserRooms: getUserRoomsMock,
    deactivateUser: deactivateUserMock
  }
}))

vi.mock('@/composables/common/useActionFeedback', () => ({
  useActionFeedback: () => ({
    showFeedback: showFeedbackMock
  })
}))

vi.mock('@/utils/Logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  })
}))

vi.mock('@iconify/vue', () => ({
  Icon: {
    name: 'Icon',
    template: '<i data-test="icon" />'
  }
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string, params?: Record<string, unknown>) =>
      key === 'admin.guests.deactivate_confirm' && params?.userId
        ? `admin.guests.deactivate_confirm:${params.userId}`
        : key
  })
}))

vi.mock('naive-ui', async () => {
  const { defineComponent, h } = await import('vue')

  const passthrough = (name: string, tag = 'div') =>
    defineComponent({
      name,
      props: ['show', 'data', 'columns', 'description', 'bordered', 'column', 'labelPlacement', 'size', 'type'],
      setup(props, { slots }) {
        return () =>
          h(tag, { 'data-test': name }, [
            slots.default?.(),
            props.description ? h('span', String(props.description)) : null
          ])
      }
    })

  return {
    useDialog: () => ({
      warning: warningMock
    }),
    NButton: defineComponent({
      name: 'NButton',
      emits: ['click'],
      setup(_, { slots, emit }) {
        return () => h('button', { type: 'button', onClick: () => emit('click') }, slots.default?.())
      }
    }),
    NCard: passthrough('NCard'),
    NDataTable: defineComponent({
      name: 'NDataTable',
      props: ['data', 'columns', 'bordered', 'striped', 'size', 'rowKey'],
      setup(props) {
        return () => h('div', { 'data-test': 'NDataTable' }, JSON.stringify(props.data ?? []))
      }
    }),
    NDescriptions: passthrough('NDescriptions'),
    NDescriptionsItem: passthrough('NDescriptionsItem'),
    NDivider: passthrough('NDivider', 'hr'),
    NEmpty: passthrough('NEmpty'),
    NIcon: passthrough('NIcon'),
    NSpace: passthrough('NSpace'),
    NSpin: passthrough('NSpin'),
    NTag: passthrough('NTag')
  }
})

describe('AdminGuests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getUsersMock.mockResolvedValue({
      users: [
        {
          userId: '@guest1:server.test',
          displayname: 'Guest One',
          createdTs: 1000,
          lastSeenTs: 3000,
          deactivated: false,
          isGuest: true
        },
        {
          userId: '@guest2:server.test',
          displayname: 'Guest Two',
          createdTs: 2000,
          lastSeenTs: 4000,
          deactivated: true,
          isGuest: true
        }
      ]
    })
    getUserRoomsMock.mockImplementation(async (userId: string) => {
      if (userId === '@guest1:server.test') {
        return [{ roomId: '!room1:server.test', membership: 'join', isRoomAdmin: false }]
      }
      return [{ roomId: '!room2:server.test', membership: '', isRoomAdmin: false }]
    })
    deactivateUserMock.mockResolvedValue(undefined)
  })

  const mountComponent = () => mount(AdminGuests)

  it('挂载时按 guest 用户聚合访客概览', async () => {
    const wrapper = mountComponent()
    await flushPromises()

    expect(getUsersMock).toHaveBeenCalledWith(200, undefined, undefined, true)
    expect(wrapper.text()).toContain('2')
    expect(wrapper.text()).toContain('@guest2:server.test')
  })

  it('加载访客房间时按 guest 用户逐个查询 admin 房间接口', async () => {
    const wrapper = mountComponent()
    await flushPromises()

    const loadRoomsButton = wrapper
      .findAll('button')
      .find((button) => button.text().includes('admin.guests.load_rooms'))
    expect(loadRoomsButton).toBeDefined()

    await loadRoomsButton!.trigger('click')
    await flushPromises()

    expect(getUserRoomsMock).toHaveBeenCalledTimes(2)
    expect(getUserRoomsMock).toHaveBeenNthCalledWith(1, '@guest1:server.test')
    expect(getUserRoomsMock).toHaveBeenNthCalledWith(2, '@guest2:server.test')

    const tables = wrapper.findAllComponents({ name: 'NDataTable' })
    expect(tables).toHaveLength(2)
    expect(tables[1].props('data')).toEqual([
      {
        userId: '@guest1:server.test',
        roomId: '!room1:server.test',
        roomName: '!room1:server.test',
        accessLevel: 'join'
      },
      {
        userId: '@guest2:server.test',
        roomId: '!room2:server.test',
        roomName: '!room2:server.test',
        accessLevel: 'admin.guests.access_level_joined'
      }
    ])
  })
})
