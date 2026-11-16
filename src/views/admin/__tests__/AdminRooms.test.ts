import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * AdminRooms 页面级四态用例（与 `AdminUsers.test.ts` 同一 mock 工厂口径）。
 *
 * 只 mock 外部边界：admin service、store 门控、反馈、错误处理、i18n、图标、naive-ui、
 * 以及三个子组件（表格 / 治理面板 / 危险操作区）。被测页面的取数与状态判断走真实代码。
 *
 * 注意：`AdminRooms` 挂载时会并行发两个请求（`getRooms` + `getRoomStats`），
 * 因此「非管理员不请求」要同时断言两个都没被调用。
 */
const { getRoomsMock, getRoomStatsMock, showFeedbackMock, handleAdminErrorMock, warningMock, state } = vi.hoisted(
  () => ({
    getRoomsMock: vi.fn(),
    getRoomStatsMock: vi.fn(),
    showFeedbackMock: vi.fn(),
    handleAdminErrorMock: vi.fn(),
    warningMock: vi.fn(),
    state: { isAdmin: true }
  })
)

vi.mock('@/services/matrix/admin', () => ({
  adminService: {
    getRooms: (...args: unknown[]) => getRoomsMock(...args),
    getRoomStats: (...args: unknown[]) => getRoomStatsMock(...args)
  }
}))

vi.mock('@/stores/domains/admin/admin', () => ({
  useAdminStore: () => ({ isAdmin: state.isAdmin })
}))

vi.mock('@/composables/common/useActionFeedback', () => ({
  useActionFeedback: () => ({ showFeedback: showFeedbackMock })
}))

vi.mock('../useAdminError', () => ({
  useAdminErrorHandler: () => ({
    handleAdminError: handleAdminErrorMock,
    ADMIN_PERMISSION_DENIED: 'ADMIN_PERMISSION_DENIED'
  })
}))

vi.mock('@/services/matrix/room/RoomFacade', () => ({
  matrixRoomActionFacade: { deleteRoomAlias: vi.fn() }
}))

vi.mock('@iconify/vue', () => ({ Icon: { template: '<i data-test="icon" />' } }))

vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }))

vi.mock('@/components/admin/AdminTable.vue', async () => {
  const { defineComponent, h } = await import('vue')
  return {
    default: defineComponent({
      name: 'AdminTable',
      props: ['columns', 'data', 'loading', 'pagination', 'rowKey'],
      setup(props) {
        return () =>
          h('div', {
            'data-test': 'AdminTable',
            'data-loading': String(Boolean(props.loading)),
            'data-count': String((props.data as unknown[] | undefined)?.length ?? 0)
          })
      }
    })
  }
})

vi.mock('@/components/admin/rooms/AdminRoomGovernancePanel.vue', async () => {
  const { defineComponent, h } = await import('vue')
  return { default: defineComponent({ name: 'AdminRoomGovernancePanel', setup: () => () => h('div') }) }
})

vi.mock('../AdminRoomDangerZone.vue', async () => {
  const { defineComponent, h } = await import('vue')
  return { default: defineComponent({ name: 'AdminRoomDangerZone', setup: () => () => h('div') }) }
})

vi.mock('naive-ui', async () => {
  const { defineComponent, h } = await import('vue')
  // 抽屉在 jsdom 里会 teleport；只渲染骨架，且只在 show 时渲染内容（避免读 null 的 selectedRoom）
  const drawer = (name: string) =>
    defineComponent({
      name,
      props: ['show', 'placement', 'width', 'title'],
      setup(props, { slots }) {
        return () => (props.show ? h('div', { 'data-test': name }, [slots.default?.(), slots.footer?.()]) : null)
      }
    })
  const passthrough = (name: string) =>
    defineComponent({
      name,
      props: ['show', 'size', 'type', 'title', 'value', 'label', 'options'],
      setup(_, { slots }) {
        return () => h('div', { 'data-test': name }, [slots.default?.()])
      }
    })
  return {
    useDialog: () => ({ warning: warningMock, error: warningMock, success: vi.fn() }),
    NButton: defineComponent({
      name: 'NButton',
      props: ['size', 'type', 'loading', 'disabled'],
      emits: ['click'],
      setup(_, { slots, emit }) {
        return () => h('button', { type: 'button', onClick: () => emit('click') }, slots.default?.())
      }
    }),
    NInput: defineComponent({
      name: 'NInput',
      props: ['value', 'placeholder', 'clearable'],
      emits: ['update:value', 'keyup'],
      setup:
        (_, { emit }) =>
        () =>
          h('input', {
            onInput: (e: Event) => emit('update:value', (e.target as HTMLInputElement).value),
            onKeyup: () => emit('keyup')
          })
    }),
    NAlert: defineComponent({
      name: 'NAlert',
      props: ['type', 'bordered'],
      setup(_, { slots }) {
        return () => h('div', { 'data-test': 'NAlert' }, slots.default?.())
      }
    }),
    NDrawer: drawer('NDrawer'),
    NDrawerContent: drawer('NDrawerContent'),
    NCard: passthrough('NCard'),
    NSpin: defineComponent({
      name: 'NSpin',
      props: ['show'],
      setup(props, { slots }) {
        return () => h('div', { 'data-test': 'NSpin', 'data-show': String(Boolean(props.show)) }, slots.default?.())
      }
    }),
    NTabs: passthrough('NTabs'),
    NTabPane: passthrough('NTabPane'),
    NSpace: passthrough('NSpace'),
    NTag: passthrough('NTag'),
    NEmpty: passthrough('NEmpty'),
    NGrid: passthrough('NGrid'),
    NGi: passthrough('NGi'),
    NStatistic: passthrough('NStatistic'),
    NForm: passthrough('NForm'),
    NFormItem: passthrough('NFormItem'),
    NDescriptions: passthrough('NDescriptions'),
    NDescriptionsItem: passthrough('NDescriptionsItem'),
    NDataTable: defineComponent({
      name: 'NDataTable',
      props: ['data', 'columns', 'loading', 'rowKey'],
      setup(props) {
        return () =>
          h('div', { 'data-test': 'NDataTable', 'data-count': String((props.data as unknown[])?.length ?? 0) })
      }
    })
  }
})

import AdminRooms from '../AdminRooms.vue'

const ROOM_A = { roomId: '!r1:hs', name: 'R1', numJoinedMembers: 3, public: false, creator: '@a:hs' }
const ROOM_B = { roomId: '!r2:hs', name: 'R2', numJoinedMembers: 5, public: true, creator: '@b:hs' }

const mountPage = () => mount(AdminRooms)
const table = (wrapper: ReturnType<typeof mount>) => wrapper.find('[data-test="AdminTable"]')
const errorAlert = (wrapper: ReturnType<typeof mount>) => wrapper.find('[data-test="NAlert"]')

describe('AdminRooms — 页面级四态', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    state.isAdmin = true
    handleAdminErrorMock.mockReturnValue(false)
    getRoomsMock.mockResolvedValue({ rooms: [ROOM_A, ROOM_B], nextToken: undefined })
    getRoomStatsMock.mockResolvedValue({ totalRooms: 2, totalMembers: 8 })
  })

  it('非管理员挂载时房间列表与统计都不请求', async () => {
    state.isAdmin = false

    const wrapper = mountPage()
    await flushPromises()

    expect(getRoomsMock).not.toHaveBeenCalled()
    expect(getRoomStatsMock).not.toHaveBeenCalled()
    expect(errorAlert(wrapper).exists()).toBe(false)

    wrapper.unmount()
  })

  it('加载期间表格处于 loading，完成后收起并渲染房间', async () => {
    let resolveRooms: ((value: unknown) => void) | undefined
    getRoomsMock.mockReturnValue(
      new Promise((resolve) => {
        resolveRooms = resolve
      })
    )

    const wrapper = mountPage()
    await wrapper.vm.$nextTick()

    expect(table(wrapper).attributes('data-loading')).toBe('true')

    resolveRooms?.({ rooms: [ROOM_A, ROOM_B], nextToken: undefined })
    await flushPromises()

    expect(table(wrapper).attributes('data-loading')).toBe('false')
    expect(table(wrapper).attributes('data-count')).toBe('2')
    expect(errorAlert(wrapper).exists()).toBe(false)

    wrapper.unmount()
  })

  it('空列表时不出错误提示，表格收到空数组', async () => {
    getRoomsMock.mockResolvedValue({ rooms: [], nextToken: undefined })

    const wrapper = mountPage()
    await flushPromises()

    expect(table(wrapper).attributes('data-count')).toBe('0')
    expect(errorAlert(wrapper).exists()).toBe(false)
    expect(wrapper.text()).toContain('admin.rooms.loadedCount')

    wrapper.unmount()
  })

  it('加载失败时展示可重试提示，点击重试只重读房间列表', async () => {
    getRoomsMock.mockRejectedValueOnce(new Error('boom'))
    handleAdminErrorMock.mockReturnValue(true)

    const wrapper = mountPage()
    await flushPromises()

    expect(errorAlert(wrapper).exists()).toBe(true)
    expect(errorAlert(wrapper).text()).toContain('common.load_failed')
    expect(showFeedbackMock).toHaveBeenCalledWith('common.load_failed', 'error')
    expect(getRoomsMock).toHaveBeenCalledTimes(1)

    const retry = errorAlert(wrapper)
      .findAll('button')
      .find((button) => button.text().includes('common.retry'))
    expect(retry, '错误提示里应有重试按钮').toBeDefined()

    await retry!.trigger('click')
    await flushPromises()

    expect(getRoomsMock).toHaveBeenCalledTimes(2)
    expect(errorAlert(wrapper).exists()).toBe(false)

    wrapper.unmount()
  })

  it('接口返回 failed=true 时保留已取到的房间并显示错误提示', async () => {
    getRoomsMock.mockResolvedValue({ rooms: [ROOM_A], nextToken: undefined, failed: true })

    const wrapper = mountPage()
    await flushPromises()

    expect(errorAlert(wrapper).exists()).toBe(true)
    expect(table(wrapper).attributes('data-count')).toBe('1')

    wrapper.unmount()
  })
})
