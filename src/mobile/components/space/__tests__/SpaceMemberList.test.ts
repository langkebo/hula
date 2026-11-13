import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getSpaceMemberDetails: vi.fn(),
  setSpaceMemberRole: vi.fn(),
  removeFromSpace: vi.fn(),
  showToast: vi.fn(),
  showConfirmDialog: vi.fn()
}))

vi.mock('@/services/matrix/room/MatrixSpaceService', () => ({
  matrixSpaceService: {
    getSpaceMemberDetails: mocks.getSpaceMemberDetails,
    setSpaceMemberRole: mocks.setSpaceMemberRole,
    removeFromSpace: mocks.removeFromSpace
  }
}))

vi.mock('vant', () => ({
  showToast: mocks.showToast,
  showConfirmDialog: mocks.showConfirmDialog
}))

vi.mock('@/mobile/composables/useMobileErrorText', () => ({
  useMobileErrorText: () => ({
    resolve: (err: unknown) => (err instanceof Error ? err.message : String(err))
  })
}))

import SpaceMemberList from '../SpaceMemberList.vue'

const MEMBERS = [
  { userId: '@creator:s', displayName: 'Creator', powerLevel: 100, isCreator: true, isSelf: false },
  { userId: '@admin:s', displayName: 'Admin', powerLevel: 100, isCreator: false, isSelf: false },
  { userId: '@bob:s', displayName: 'Bob', powerLevel: 0, isCreator: false, isSelf: false }
]

const mountList = (canManage: boolean) =>
  mount(SpaceMemberList, {
    props: { spaceId: '!space:s', canManage },
    global: {
      stubs: {
        'van-button': { template: '<button><slot /></button>' },
        'van-loading': true,
        'van-empty': { template: '<div><slot /></div>' },
        'van-icon': true
      }
    }
  })

describe('SpaceMemberList', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getSpaceMemberDetails.mockResolvedValue(MEMBERS)
  })

  it('canManage=false 时不渲染成员操作按钮', async () => {
    const wrapper = mountList(false)
    await flushPromises()

    expect(wrapper.findAll('[data-user-id]')).toHaveLength(3)
    expect(wrapper.find('[data-testid="member-actions"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="member-set-admin"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="member-remove"]').exists()).toBe(false)
  })

  it('canManage=true 时渲染成员操作按钮', async () => {
    const wrapper = mountList(true)
    await flushPromises()

    expect(wrapper.findAll('[data-testid="member-actions"]')).toHaveLength(2)
    expect(wrapper.findAll('[data-testid="member-set-admin"]')).toHaveLength(1)
    expect(wrapper.findAll('[data-testid="member-remove"]')).toHaveLength(2)
  })

  it('加载失败时展示错误态与可读错误信息', async () => {
    mocks.getSpaceMemberDetails.mockRejectedValue(new Error('boom'))
    const wrapper = mountList(true)
    await flushPromises()

    expect(wrapper.find('[data-test="space-members-error"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('boom')
  })
})
