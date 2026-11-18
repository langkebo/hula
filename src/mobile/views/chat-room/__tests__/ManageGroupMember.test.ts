import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, ref } from 'vue'
import ManageGroupMember from '../ManageGroupMember.vue'

/**
 * 移动端群成员管理四态。
 *
 * 回归背景：成员列表原先没有任何 loading / empty / error 处理，
 * 拉取失败会直接渲染成空白区域，用户无从判断是「没人」还是「加载失败」。
 */

const { getGroupUserListMock, goBackMock, showFeedbackMock } = vi.hoisted(() => ({
  getGroupUserListMock: vi.fn(),
  goBackMock: vi.fn(),
  showFeedbackMock: vi.fn()
}))

const memberList = ref<Array<{ uid: string; roleId: number; activeStatus: number }>>([])

vi.mock('vant', () => ({ showConfirmDialog: vi.fn() }))
vi.mock('vant/es/dialog/style', () => ({}))
vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }))
vi.mock('@/composables/common/useActionFeedback', () => ({
  useActionFeedback: () => ({ showFeedback: showFeedbackMock })
}))
vi.mock('#/composables/useSafeBack', () => ({ useSafeBack: () => ({ goBack: goBackMock }) }))
vi.mock('@/stores/domains/chat/group', () => ({
  useGroupStore: () => ({
    memberList: memberList.value,
    getGroupUserList: (...args: unknown[]) => getGroupUserListMock(...args),
    getUserInfo: () => undefined
  })
}))
vi.mock('@/stores/domains/widget/global', () => ({
  useGlobalStore: () => ({ currentSessionRoomId: '!room:server' })
}))

const MobileAsyncStateStub = defineComponent({
  name: 'MobileAsyncState',
  props: ['state', 'testId', 'minHeight', 'errorText', 'emptyText'],
  emits: ['retry'],
  template: '<div :data-testid="testId + \'-\' + state" />'
})

const mountPage = () =>
  mount(ManageGroupMember, {
    global: {
      stubs: {
        HeaderBar: true,
        MobileAsyncState: MobileAsyncStateStub
      }
    }
  })

describe('ManageGroupMember 四态', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    memberList.value = []
  })

  it('加载中展示 loading 态', async () => {
    getGroupUserListMock.mockReturnValue(new Promise(() => undefined))
    const wrapper = mountPage()
    await flushPromises()

    expect(wrapper.find('[data-testid="manage-group-member-loading"]').exists()).toBe(true)
  })

  it('加载失败展示 error 态，而不是空白列表', async () => {
    getGroupUserListMock.mockRejectedValue(new Error('network down'))
    const wrapper = mountPage()
    await flushPromises()

    expect(wrapper.find('[data-testid="manage-group-member-error"]').exists()).toBe(true)
  })

  it('重试时重新拉取成员列表', async () => {
    getGroupUserListMock.mockRejectedValueOnce(new Error('network down'))
    getGroupUserListMock.mockResolvedValueOnce(undefined)
    const wrapper = mountPage()
    await flushPromises()

    const state = wrapper.findComponent(MobileAsyncStateStub)
    state.vm.$emit('retry')
    await flushPromises()

    expect(getGroupUserListMock).toHaveBeenCalledTimes(2)
    expect(wrapper.find('[data-testid="manage-group-member-error"]').exists()).toBe(false)
  })

  it('加载成功但无可管理成员时展示空态', async () => {
    getGroupUserListMock.mockResolvedValue(undefined)
    const wrapper = mountPage()
    await flushPromises()

    expect(wrapper.find('[data-testid="manage-group-member-error"]').exists()).toBe(false)
    expect(wrapper.find('van-empty').exists()).toBe(true)
  })
})
