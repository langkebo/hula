import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, ref } from 'vue'
import { createI18nMock } from '~/tests/i18n-messages'
import MobileInviteGroupMember from '../MobileInviteGroupMember.vue'

/**
 * 移动端邀请群成员的四态。
 *
 * 回归背景：群成员读取失败时原实现把空成员列表当成事实，
 * 导致已在群内的联系人被误列为「可邀请」，邀请后必然失败。
 */

const { getGroupUserListMock, inviteUserMock, showFeedbackMock, backMock } = vi.hoisted(() => ({
  getGroupUserListMock: vi.fn(),
  inviteUserMock: vi.fn(),
  showFeedbackMock: vi.fn(),
  backMock: vi.fn()
}))

const contactsList = ref<Array<Record<string, unknown>>>([])

vi.mock('vue-i18n', () => createI18nMock())

vi.mock('@/composables/common/useActionFeedback', () => ({
  useActionFeedback: () => ({ showFeedback: showFeedbackMock })
}))

vi.mock('@/router', () => ({
  default: { back: backMock }
}))

vi.mock('@/services/matrix/room/MembershipService', () => ({
  matrixRoomMembershipService: { inviteUser: inviteUserMock }
}))

vi.mock('@/stores/domains/chat/contacts', () => ({
  useContactStore: () => ({ contactsList: contactsList.value })
}))

vi.mock('@/stores/domains/chat/group', () => ({
  useGroupStore: () => ({
    memberList: [{ uid: 'bob' }],
    getGroupUserList: getGroupUserListMock
  })
}))

vi.mock('@/stores/domains/widget/global', () => ({
  useGlobalStore: () => ({ currentSessionRoomId: '!room:server' })
}))

vi.mock('@/utils/AvatarUtils', () => ({
  AvatarUtils: { getAvatarUrl: (url: string) => url }
}))

vi.mock('@/utils/Logger', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })
}))

const MobileAsyncStateStub = defineComponent({
  name: 'MobileAsyncState',
  props: ['state', 'testId', 'minHeight', 'errorText', 'emptyText'],
  emits: ['retry'],
  template: '<div :data-testid="testId + \'-\' + state" />'
})

const VanButtonStub = defineComponent({
  name: 'van-button',
  props: ['disabled', 'loading', 'type'],
  emits: ['click'],
  template: '<button :disabled="disabled" @click="$emit(\'click\')"><slot /></button>'
})

const mountPage = () =>
  mount(MobileInviteGroupMember, {
    global: {
      stubs: {
        HeaderBar: true,
        MobileAsyncState: MobileAsyncStateStub,
        AutoFixHeightPage: {
          template: '<div><slot name="header" /><slot name="container" /><slot name="footer" /></div>'
        }
      },
      components: {
        'van-button': VanButtonStub,
        'van-field': defineComponent({
          props: ['modelValue', 'placeholder'],
          emits: ['update:modelValue'],
          template: '<input />'
        }),
        'van-checkbox-group': defineComponent({
          props: ['modelValue'],
          emits: ['update:modelValue'],
          template: '<div><slot /></div>'
        }),
        'van-checkbox': defineComponent({
          props: ['name'],
          template: '<div data-test="contact-checkbox"><slot /></div>'
        })
      }
    }
  })

describe('MobileInviteGroupMember 四态', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    contactsList.value = [{ userId: 'alice', displayName: 'Alice', account: 'alice', avatarUrl: '', activeStatus: 1 }]
  })

  it('群成员读取失败时展示错误态，且不把联系人误列为可邀请', async () => {
    getGroupUserListMock.mockRejectedValue(new Error('network down'))

    const wrapper = mountPage()
    await flushPromises()

    expect(wrapper.find('[data-testid="invite-member-list-error"]').exists()).toBe(true)
    // 成员未知时不得渲染候选列表（Alice 是否在群内无法判断）
    expect(wrapper.find('[data-test="contact-checkbox"]').exists()).toBe(false)
    expect(wrapper.find('button').attributes('disabled')).toBeDefined()
  })

  it('失败后重试成功才渲染候选列表', async () => {
    getGroupUserListMock.mockRejectedValueOnce(new Error('network down'))
    getGroupUserListMock.mockResolvedValueOnce(undefined)

    const wrapper = mountPage()
    await flushPromises()

    expect(wrapper.find('[data-testid="invite-member-list-error"]').exists()).toBe(true)

    wrapper.findComponent(MobileAsyncStateStub).vm.$emit('retry')
    await flushPromises()

    expect(getGroupUserListMock).toHaveBeenCalledTimes(2)
    expect(wrapper.find('[data-testid="invite-member-list-error"]').exists()).toBe(false)
    expect(wrapper.find('[data-test="contact-checkbox"]').exists()).toBe(true)
  })
})
