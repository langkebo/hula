import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import StartGroupChat from '../StartGroupChat.vue'

/**
 * F-12：发起群聊至少 2 人才能提交，且成员候选支持本地搜索（昵称 / 账号 / ID）。
 */

const createRoomMock = vi.fn()
const showFeedbackMock = vi.fn()

const contacts = [
  { userId: 'u1', activeStatus: 1 },
  { userId: 'u2', activeStatus: 0 }
]

const memberInfo: Record<string, { name: string; account: string; avatar: string; userStateId: string }> = {
  u1: { name: '张三', account: 'zhangsan', avatar: '', userStateId: '' },
  u2: { name: '李四', account: 'lisi', avatar: '', userStateId: '' }
}

vi.mock('@/stores/domains/chat/contacts', () => ({
  useContactStore: () => ({ contactsList: contacts })
}))

vi.mock('@/stores/domains/chat/group', () => ({
  useGroupStore: () => ({
    getUserInfo: (uid: string) => memberInfo[uid] ?? null,
    addGroupDetail: vi.fn().mockResolvedValue(undefined),
    getGroupUserList: vi.fn().mockResolvedValue(undefined)
  })
}))

vi.mock('@/stores/domains/chat/chat', () => ({
  useChatStore: () => ({
    sessionList: [],
    getSessionList: vi.fn().mockResolvedValue(undefined)
  })
}))

vi.mock('@/stores/domains/user/userStatus', async () => {
  const { ref: createRef } = await import('vue')
  return { useUserStatusStore: () => ({ stateList: createRef([]) }) }
})

vi.mock('@/stores/domains/widget/global', () => ({
  useGlobalStore: () => ({ updateCurrentSessionRoomId: vi.fn() })
}))

vi.mock('@/services/matrix/room/CreationService', () => ({
  matrixRoomCreationService: { createRoom: (...args: unknown[]) => createRoomMock(...args) }
}))

vi.mock('@/services/matrix/sdk', () => ({
  Preset: { PrivateChat: 'private_chat' },
  Visibility: { Private: 'private' }
}))

vi.mock('@/composables/common/useActionFeedback', () => ({
  useActionFeedback: () => ({ showFeedback: (...args: unknown[]) => showFeedbackMock(...args) })
}))

vi.mock('@/utils/AvatarUtils', () => ({
  AvatarUtils: { getAvatarUrl: (avatar?: string) => avatar || '/logo.png' }
}))

vi.mock('@/mobile/components/chat-room/HeaderBar.vue', () => ({
  default: { name: 'HeaderBar', template: '<div />' }
}))

// 模板中的 van-* 未显式 import（靠自动注册），测试里手动注册轻量替身
const { defineComponent } = await import('vue')
const vantStubs = {
  'van-field': defineComponent({
    name: 'VanField',
    props: ['modelValue', 'placeholder'],
    emits: ['update:modelValue', 'clear'],
    template: '<input :value="modelValue" :placeholder="placeholder" />'
  }),
  'van-checkbox-group': defineComponent({
    name: 'VanCheckboxGroup',
    props: ['modelValue'],
    emits: ['update:modelValue'],
    template: '<div class="van-checkbox-group"><slot /></div>'
  }),
  'van-checkbox': defineComponent({
    name: 'VanCheckbox',
    props: ['name'],
    template: '<div class="van-checkbox"><slot /></div>'
  }),
  'van-button': defineComponent({
    name: 'VanButton',
    props: ['disabled', 'type', 'size'],
    emits: ['click'],
    template: '<button :disabled="disabled" @click="$emit(\'click\')"><slot /></button>'
  }),
  'van-empty': defineComponent({
    name: 'VanEmpty',
    props: ['description', 'image'],
    template: '<div class="van-empty">{{ description }}</div>'
  })
}

type PageVm = {
  keyword: string
  selectedList: string[]
  filteredContacts: Array<{ userId: string }>
  createGroup: () => Promise<void>
}

const mountPage = () => mount(StartGroupChat, { global: { components: vantStubs } })
const vmOf = (wrapper: ReturnType<typeof mount>) => wrapper.vm as unknown as PageVm

describe('StartGroupChat 人数校验与成员搜索（F-12）', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    createRoomMock.mockResolvedValue({ roomId: '!new:test' })
  })

  it('仅选择 1 人时提交按钮禁用并给出提示', async () => {
    const wrapper = mountPage()
    const vm = vmOf(wrapper)

    vm.selectedList = ['u1']
    await nextTick()

    expect(wrapper.find('button').attributes('disabled')).toBeDefined()
    expect(wrapper.text()).toContain('mobile_chat_setting.create_group_need_two')

    await vm.createGroup()
    expect(createRoomMock).not.toHaveBeenCalled()
  })

  it('选择 2 人后可以提交并创建群聊', async () => {
    const wrapper = mountPage()
    const vm = vmOf(wrapper)

    vm.selectedList = ['u1', 'u2']
    await nextTick()

    expect(wrapper.find('button').attributes('disabled')).toBeUndefined()
    await vm.createGroup()
    await flushPromises()

    expect(createRoomMock).toHaveBeenCalledWith(expect.objectContaining({ invite: ['u1', 'u2'] }))
  })

  it('按昵称过滤成员', async () => {
    const wrapper = mountPage()
    const vm = vmOf(wrapper)

    vm.keyword = '李'
    await nextTick()

    expect(vm.filteredContacts.map((item) => item.userId)).toEqual(['u2'])
    expect(wrapper.text()).toContain('李四')
    expect(wrapper.text()).not.toContain('张三')
  })

  it('按账号 / ID 过滤成员', async () => {
    const wrapper = mountPage()
    const vm = vmOf(wrapper)

    vm.keyword = 'zhangsan'
    await nextTick()

    expect(vm.filteredContacts.map((item) => item.userId)).toEqual(['u1'])
  })

  it('搜索无结果时展示空态', async () => {
    const wrapper = mountPage()
    const vm = vmOf(wrapper)

    vm.keyword = '不存在的人'
    await nextTick()

    expect(vm.filteredContacts).toHaveLength(0)
    expect(wrapper.text()).toContain('mobile_contact.search_no_result')
  })
})
