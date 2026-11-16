import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * AdminUsers 页面级四态用例。
 *
 * 为什么要这层：`useAdminUsers` 有单测，但「页面是否真的把 loadError 渲染出来、重试是否只重读、
 * 门控是否挡住请求」只有页面级用例能锁。mock 工厂沿用 §19.12（AdminDashboard）的写法：
 * 只 mock 外部边界（admin service / store / 反馈 / i18n / naive-ui / 子组件），
 * 让被测页面的真实逻辑（含 `useAdminUsers`）跑起来。
 */
const { getUsersMock, showFeedbackMock, handleAdminErrorMock, warningMock, state } = vi.hoisted(() => ({
  getUsersMock: vi.fn(),
  showFeedbackMock: vi.fn(),
  handleAdminErrorMock: vi.fn(),
  warningMock: vi.fn(),
  state: { isAdmin: true }
}))

vi.mock('@/services/matrix/admin', () => ({
  adminService: { getUsers: (...args: unknown[]) => getUsersMock(...args) }
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

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key })
}))

/** AdminTable 桩：把 data / loading 暴露成 data-* 便于断言，避免引入 NDataTable 的渲染细节 */
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

vi.mock('@/components/admin/AdminBulkActionBar.vue', async () => {
  const { defineComponent, h } = await import('vue')
  return {
    default: defineComponent({ name: 'AdminBulkActionBar', setup: () => () => h('div', { 'data-test': 'bulk' }) })
  }
})

vi.mock('../AdminUsersCreateDrawer.vue', async () => {
  const { defineComponent, h } = await import('vue')
  return { default: defineComponent({ name: 'AdminUsersCreateDrawer', setup: () => () => h('div') }) }
})

vi.mock('../AdminUsersBatchCreateDrawer.vue', async () => {
  const { defineComponent, h } = await import('vue')
  return { default: defineComponent({ name: 'AdminUsersBatchCreateDrawer', setup: () => () => h('div') }) }
})

vi.mock('../AdminUserDetailDrawer.vue', async () => {
  const { defineComponent, h } = await import('vue')
  return { default: defineComponent({ name: 'AdminUserDetailDrawer', setup: () => () => h('div') }) }
})

vi.mock('naive-ui', async () => {
  const { defineComponent, h } = await import('vue')
  const passthrough = (name: string) =>
    defineComponent({
      name,
      setup(_, { slots }) {
        return () => h('div', { 'data-test': name }, slots.default?.())
      }
    })
  return {
    useDialog: () => ({ warning: warningMock, error: warningMock, success: vi.fn() }),
    NSpace: passthrough('NSpace'),
    NInput: defineComponent({
      name: 'NInput',
      props: ['value', 'placeholder', 'clearable'],
      emits: ['update:value'],
      setup:
        (_, { emit }) =>
        () =>
          h('input', { onInput: (e: Event) => emit('update:value', (e.target as HTMLInputElement).value) })
    }),
    NSelect: defineComponent({
      name: 'NSelect',
      props: ['value', 'options'],
      emits: ['update:value'],
      setup: () => () => h('select')
    }),
    NButton: defineComponent({
      name: 'NButton',
      props: ['size', 'type', 'loading'],
      emits: ['click'],
      setup(_, { slots, emit }) {
        return () => h('button', { type: 'button', onClick: () => emit('click') }, slots.default?.())
      }
    }),
    NAlert: defineComponent({
      name: 'NAlert',
      props: ['type', 'bordered'],
      setup(_, { slots }) {
        return () => h('div', { 'data-test': 'NAlert' }, slots.default?.())
      }
    })
  }
})

import AdminUsers from '../AdminUsers.vue'

const USER_A = { userId: '@u1:hs', displayname: 'U1', admin: false, deactivated: false, creation_ts: 1 }
const USER_B = { userId: '@u2:hs', displayname: 'U2', admin: true, deactivated: false, creation_ts: 2 }

const mountPage = () => mount(AdminUsers)
const table = (wrapper: ReturnType<typeof mount>) => wrapper.find('[data-test="AdminTable"]')
const errorAlert = (wrapper: ReturnType<typeof mount>) => wrapper.find('[data-test="NAlert"]')

describe('AdminUsers — 页面级四态', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    state.isAdmin = true
    handleAdminErrorMock.mockReturnValue(false)
    getUsersMock.mockResolvedValue({ users: [USER_A, USER_B], nextToken: undefined })
  })

  it('非管理员挂载时不发起用户请求，也不渲染错误提示', async () => {
    state.isAdmin = false

    const wrapper = mountPage()
    await flushPromises()

    expect(getUsersMock).not.toHaveBeenCalled()
    expect(errorAlert(wrapper).exists()).toBe(false)
    expect(table(wrapper).attributes('data-count')).toBe('0')

    wrapper.unmount()
  })

  it('加载期间表格处于 loading，完成后收起并渲染数据', async () => {
    let resolveUsers: ((value: unknown) => void) | undefined
    getUsersMock.mockReturnValue(
      new Promise((resolve) => {
        resolveUsers = resolve
      })
    )

    const wrapper = mountPage()
    await wrapper.vm.$nextTick()

    expect(table(wrapper).attributes('data-loading')).toBe('true')

    resolveUsers?.({ users: [USER_A, USER_B], nextToken: undefined })
    await flushPromises()

    expect(table(wrapper).attributes('data-loading')).toBe('false')
    expect(table(wrapper).attributes('data-count')).toBe('2')
    expect(errorAlert(wrapper).exists()).toBe(false)

    wrapper.unmount()
  })

  it('空列表时不渲染错误提示，表格收到空数组', async () => {
    getUsersMock.mockResolvedValue({ users: [], nextToken: undefined })

    const wrapper = mountPage()
    await flushPromises()

    expect(table(wrapper).attributes('data-count')).toBe('0')
    expect(errorAlert(wrapper).exists()).toBe(false)
    expect(wrapper.text()).toContain('admin.users.loadedCount')

    wrapper.unmount()
  })

  it('加载失败（接口 reject）时展示可重试提示，点击重试只重读一次列表', async () => {
    getUsersMock.mockRejectedValueOnce(new Error('boom'))
    handleAdminErrorMock.mockReturnValue(true)

    const wrapper = mountPage()
    await flushPromises()

    expect(errorAlert(wrapper).exists()).toBe(true)
    expect(errorAlert(wrapper).text()).toContain('common.load_failed')
    // 页面自身也要给反馈（不只依赖 alert），且失败时不得伪装成空列表为「成功」
    expect(showFeedbackMock).toHaveBeenCalledWith('common.load_failed', 'error')
    expect(getUsersMock).toHaveBeenCalledTimes(1)

    const retry = errorAlert(wrapper)
      .findAll('button')
      .find((button) => button.text().includes('common.retry'))
    expect(retry, '错误提示里应有重试按钮').toBeDefined()

    await retry!.trigger('click')
    await flushPromises()

    expect(getUsersMock).toHaveBeenCalledTimes(2)
    expect(errorAlert(wrapper).exists()).toBe(false)

    wrapper.unmount()
  })

  it('接口返回 failed=true 时视为 partial 失败：仍展示数据但标记错误', async () => {
    getUsersMock.mockResolvedValue({ users: [USER_A], nextToken: undefined, failed: true })

    const wrapper = mountPage()
    await flushPromises()

    expect(errorAlert(wrapper).exists()).toBe(true)
    // 部分成功：数据照常渲染，不被失败拖成空表
    expect(table(wrapper).attributes('data-count')).toBe('1')

    wrapper.unmount()
  })
})
