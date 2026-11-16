import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * 「写操作失败后保留用户输入 + 可重试」的组件级判据（§13.11 条目 2 / §19.11 遗留 3）。
 *
 * 为什么用组件级而不是 E2E：断网与后端 4xx 在组件边界上是同一件事 —— facade 调用 reject。
 * 这里把 reject 注入到 `matrixRoomActionFacade`，断言三件只有 UI 层才能保证的事：
 *   1. 输入框里的文本**不被清空**（清空只发生在 `await` 成功之后）；
 *   2. 反馈是**失败**文案，不得误报成功；
 *   3. 按钮回到可点状态 ⇒ 用户点同一按钮即可重试（不要求额外入口）。
 *
 * 覆盖：房间成员邀请、房间设置（名称/主题）、房间别名。标签页同源（`if (ok) 清空`），
 * 由 `useRoomTags` 单测覆盖，这里不重复搭桩。
 */
const { showFeedbackMock, facade, groupStore, state } = vi.hoisted(() => ({
  showFeedbackMock: vi.fn(),
  facade: {
    inviteUser: vi.fn(),
    kickUser: vi.fn(),
    banUser: vi.fn(),
    getAliases: vi.fn(),
    setRoomAlias: vi.fn(),
    deleteRoomAlias: vi.fn(),
    setRoomName: vi.fn(),
    setRoomTopic: vi.fn(),
    setRoomAvatar: vi.fn()
  },
  groupStore: {
    loadRoomMembers: vi.fn(),
    getMembersByRoomId: vi.fn(),
    getMembersLoadError: vi.fn(),
    loadGroupInfo: vi.fn(),
    getGroupDetailByRoomId: vi.fn()
  },
  state: { members: [] as Array<Record<string, unknown>> }
}))

vi.mock('@/services/matrix/room/RoomFacade', () => ({ matrixRoomActionFacade: facade }))

vi.mock('@/composables/common/useActionFeedback', () => ({
  useActionFeedback: () => ({ showFeedback: showFeedbackMock })
}))

vi.mock('@/stores/domains/chat/group', () => ({
  useGroupStore: () => ({
    loadRoomMembers: (...args: unknown[]) => groupStore.loadRoomMembers(...args),
    getMembersByRoomId: (...args: unknown[]) => groupStore.getMembersByRoomId(...args),
    getMembersLoadError: (...args: unknown[]) => groupStore.getMembersLoadError(...args),
    loadGroupInfo: (...args: unknown[]) => groupStore.loadGroupInfo(...args),
    getGroupDetailByRoomId: (...args: unknown[]) => groupStore.getGroupDetailByRoomId(...args)
  })
}))

vi.mock('@/services/matrix/MatrixClientService', () => ({
  matrixClientService: { getUserId: () => '@me:hs' }
}))

vi.mock('@/services/matrix/media/MatrixMediaService', () => ({
  matrixMediaService: { getThumbnailUrl: () => 'blob:thumb' }
}))

vi.mock('@/composables/user/useAvatarUpload', () => ({
  useAvatarUpload: () => ({ uploadAvatar: vi.fn(), uploading: { value: false }, error: { value: null } })
}))

vi.mock('@vueuse/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@vueuse/core')>()
  return { ...actual, useClipboard: () => ({ copy: vi.fn() }) }
})

vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }))

/** 标签页的写逻辑在 `useRoomTags` 里（`if (ok) 清空`），故 mock 该 composable 而非其内部 service */
const tagsFlow = vi.hoisted(() => ({
  addTag: vi.fn(),
  removeTag: vi.fn(),
  load: vi.fn()
}))

vi.mock('@/composables/room/useRoomTags', () => ({
  useRoomTags: () => ({
    tags: { value: [] },
    hasTags: { value: false },
    loading: { value: false },
    updating: { value: false },
    errorMessage: { value: null },
    addTag: (...args: unknown[]) => tagsFlow.addTag(...args),
    removeTag: (...args: unknown[]) => tagsFlow.removeTag(...args),
    load: (...args: unknown[]) => tagsFlow.load(...args)
  })
}))

vi.mock('naive-ui', async () => {
  const { defineComponent, h } = await import('vue')
  return {
    useDialog: () => ({ warning: vi.fn(), error: vi.fn(), success: vi.fn() }),
    // 这些 tab 用 `import { NInput } from 'naive-ui'`（自动导入），必须模块级 mock 才拦得到
    NInput: defineComponent({
      name: 'NInput',
      inheritAttrs: false,
      props: ['value', 'type', 'rows', 'readonly', 'placeholder'],
      emits: ['update:value'],
      setup(props, { emit, attrs }) {
        return () => {
          const isTextarea = props.type === 'textarea'
          const tag = isTextarea ? 'textarea' : 'input'
          return h(tag as 'input', {
            ...attrs,
            value: props.value ?? '',
            readonly: props.readonly,
            placeholder: props.placeholder,
            onInput: (event: Event) => emit('update:value', (event.target as HTMLInputElement).value)
          })
        }
      }
    }),
    NButton: defineComponent({
      name: 'NButton',
      inheritAttrs: false,
      props: ['loading', 'disabled', 'type', 'size', 'quaternary'],
      emits: ['click'],
      setup(props, { slots, emit, attrs }) {
        return () =>
          h(
            'button',
            {
              ...attrs,
              type: 'button',
              disabled: Boolean(props.disabled || props.loading),
              onClick: () => emit('click')
            },
            slots.default?.()
          )
      }
    }),
    NSpin: defineComponent({
      name: 'NSpin',
      props: ['show', 'size'],
      setup(_, { slots }) {
        return () => h('div', { class: 'n-spin' }, slots.default?.())
      }
    }),
    NAvatar: defineComponent({
      name: 'NAvatar',
      props: ['src', 'size', 'round'],
      setup: () => () => h('div', { class: 'n-avatar' })
    }),
    NTag: defineComponent({
      name: 'NTag',
      props: ['type', 'size'],
      setup:
        (_, { slots }) =>
        () =>
          h('span', slots.default?.())
    }),
    NAlert: defineComponent({
      name: 'NAlert',
      props: ['type', 'showIcon'],
      setup:
        (_, { slots }) =>
        () =>
          h('div', slots.default?.())
    }),
    NEmpty: defineComponent({
      name: 'NEmpty',
      props: ['description', 'size'],
      setup: () => () => h('div', { class: 'n-empty' })
    }),
    NDivider: defineComponent({ name: 'NDivider', setup: () => () => h('hr') }),
    // 成员动作挂在 popconfirm 上：桩里把 trigger 与「确定」都渲染出来，用例先点 trigger 再点确定
    NPopconfirm: defineComponent({
      name: 'NPopconfirm',
      emits: ['positive-click'],
      setup(_, { slots, emit }) {
        return () =>
          h('span', { class: 'n-popconfirm' }, [
            slots.trigger?.(),
            h('button', { type: 'button', class: 'n-popconfirm-positive', onClick: () => emit('positive-click') }, 'ok')
          ])
      }
    })
  }
})

const globalStubs = {
  EmptyState: { template: '<div data-test="empty-state" />' },
  PartialStateBanner: { template: '<div data-test="partial-state" />' },
  AvatarCropper: { template: '<div data-test="avatar-cropper" />' }
}

beforeEach(() => {
  vi.clearAllMocks()
  groupStore.getMembersByRoomId.mockImplementation(() => state.members)
  groupStore.getMembersLoadError.mockReturnValue(null)
  groupStore.loadRoomMembers.mockResolvedValue(undefined)
  groupStore.loadGroupInfo.mockResolvedValue(undefined)
  groupStore.getGroupDetailByRoomId.mockReturnValue({ name: '原名', topic: '原话题', avatar: '', memberCount: 3 })
  facade.getAliases.mockResolvedValue([])
})

describe('房间成员 — 邀请失败保留输入且可重试', () => {
  it('邀请被拒（4xx/断网）后输入不清空、报失败、可直接再点一次', async () => {
    const MembersTab = (await import('../MembersTab.vue')).default
    facade.inviteUser.mockRejectedValueOnce(new Error('M_FORBIDDEN'))

    const wrapper = mount(MembersTab, { props: { roomId: '!r:hs' }, global: { stubs: globalStubs } })
    await flushPromises()

    const input = wrapper.find('[data-testid="members-invite-input"]')
    await input.setValue('@alice:hs')
    await wrapper.find('[data-testid="members-invite-button"]').trigger('click')
    await flushPromises()

    expect(facade.inviteUser).toHaveBeenCalledWith('!r:hs', '@alice:hs')
    expect(showFeedbackMock).toHaveBeenCalledWith('room.detail.invite_failed', 'error')
    // 关键断言：失败不得清空输入
    expect((wrapper.find('[data-testid="members-invite-input"]').element as HTMLInputElement).value).toBe('@alice:hs')

    // 重试：同一按钮再点一次即可（不需要额外入口）
    facade.inviteUser.mockResolvedValueOnce(undefined)
    await wrapper.find('[data-testid="members-invite-button"]').trigger('click')
    await flushPromises()

    expect(facade.inviteUser).toHaveBeenCalledTimes(2)
    expect(showFeedbackMock).toHaveBeenCalledWith('room.detail.invite_success', 'success')
    // 成功后输入才允许清空
    expect((wrapper.find('[data-testid="members-invite-input"]').element as HTMLInputElement).value).toBe('')

    wrapper.unmount()
  })

  it('踢人失败只报失败，不误报成功', async () => {
    state.members = [{ userId: '@bob:hs', displayName: 'Bob', powerLevel: 0, membership: 'join', avatarUrl: undefined }]
    const MembersTab = (await import('../MembersTab.vue')).default
    facade.kickUser.mockRejectedValueOnce(new Error('M_FORBIDDEN'))

    const wrapper = mount(MembersTab, { props: { roomId: '!r:hs' }, global: { stubs: globalStubs } })
    await flushPromises()

    await wrapper.find('.n-popconfirm-positive').trigger('click')
    await flushPromises()

    expect(facade.kickUser).toHaveBeenCalledWith('!r:hs', '@bob:hs')
    expect(showFeedbackMock).toHaveBeenCalledWith('room.detail.kick_failed', 'error')
    expect(showFeedbackMock).not.toHaveBeenCalledWith('room.detail.kick_success', 'success')

    wrapper.unmount()
  })
})

describe('房间设置 — 名称/主题保存失败保留输入且可重试', () => {
  it('保存被拒后两个输入框内容都在，按钮回到可点状态', async () => {
    const BasicTab = (await import('../BasicTab.vue')).default
    facade.setRoomName.mockRejectedValueOnce(new Error('M_FORBIDDEN'))

    const wrapper = mount(BasicTab, { props: { roomId: '!r:hs' }, global: { stubs: globalStubs } })
    await flushPromises()

    const inputs = wrapper.findAll('input')
    await inputs[0].setValue('新名字')
    const textarea = wrapper.find('textarea')
    await textarea.setValue('新话题')

    await wrapper.find('[data-testid="basic-save"]').trigger('click')
    await flushPromises()

    expect(showFeedbackMock).toHaveBeenCalledWith('room.settings_drawer.saved_failed', 'error')
    expect((wrapper.findAll('input')[0].element as HTMLInputElement).value).toBe('新名字')
    expect((wrapper.find('textarea').element as HTMLTextAreaElement).value).toBe('新话题')
    const saveButton = wrapper.find('[data-testid="basic-save"]')
    expect((saveButton.element as HTMLButtonElement).disabled).toBe(false)

    // 重试
    facade.setRoomName.mockResolvedValueOnce(undefined)
    facade.setRoomTopic.mockResolvedValueOnce(undefined)
    await saveButton.trigger('click')
    await flushPromises()

    expect(facade.setRoomName).toHaveBeenCalledTimes(2)
    expect(showFeedbackMock).toHaveBeenCalledWith('room.settings_drawer.saved_success', 'success')

    wrapper.unmount()
  })
})

describe('房间设置 — 别名添加失败保留输入且可重试', () => {
  it('添加别名被拒后输入不清空、可再点一次', async () => {
    const AliasTab = (await import('../AliasTab.vue')).default
    facade.setRoomAlias.mockRejectedValueOnce(new Error('M_FORBIDDEN'))

    const wrapper = mount(AliasTab, { props: { roomId: '!r:hs' }, global: { stubs: globalStubs } })
    await flushPromises()

    const aliasInput = wrapper.findAll('input').at(-1)!
    await aliasInput.setValue('#new-alias:hs')
    const addButton = wrapper
      .findAll('button')
      .find((button) => button.text().includes('room.settings_drawer.action_add'))
    expect(addButton, '应存在添加别名按钮').toBeDefined()

    await addButton!.trigger('click')
    await flushPromises()

    expect(facade.setRoomAlias).toHaveBeenCalledWith('!r:hs', '#new-alias:hs')
    expect(showFeedbackMock).toHaveBeenCalledWith('room.settings_drawer.saved_failed', 'error')
    expect((wrapper.findAll('input').at(-1)!.element as HTMLInputElement).value).toBe('#new-alias:hs')

    facade.setRoomAlias.mockResolvedValueOnce(undefined)
    facade.getAliases.mockResolvedValue(['#new-alias:hs'])
    await wrapper
      .findAll('button')
      .find((button) => button.text().includes('room.settings_drawer.action_add'))!
      .trigger('click')
    await flushPromises()

    expect(facade.setRoomAlias).toHaveBeenCalledTimes(2)
    expect(showFeedbackMock).toHaveBeenCalledWith('room.settings_drawer.saved_success', 'success')

    wrapper.unmount()
  })
})

describe('房间设置 — 添加标签失败保留输入', () => {
  it('addTag 返回 false（4xx/断网）时不清空输入，可再点一次', async () => {
    const TagsTab = (await import('../TagsTab.vue')).default
    tagsFlow.load.mockResolvedValue(undefined)
    tagsFlow.addTag.mockResolvedValueOnce(false)

    const wrapper = mount(TagsTab, { props: { roomId: '!r:hs' }, global: { stubs: globalStubs } })
    await flushPromises()

    const input = wrapper.find('input')
    await input.setValue('待审')
    const addButton = wrapper.findAll('button').find((button) => button.text().includes(''))!
    // 只有一个「添加」按钮带 primary；用最后一个按钮规避图标按钮差异
    const buttons = wrapper.findAll('button')
    await buttons[buttons.length - 1].trigger('click')
    await flushPromises()

    expect(tagsFlow.addTag).toHaveBeenCalledWith('待审')
    expect((wrapper.find('input').element as HTMLInputElement).value).toBe('待审')

    tagsFlow.addTag.mockResolvedValueOnce(true)
    await wrapper.findAll('button')[wrapper.findAll('button').length - 1].trigger('click')
    await flushPromises()

    expect(tagsFlow.addTag).toHaveBeenCalledTimes(2)
    expect((wrapper.find('input').element as HTMLInputElement).value).toBe('')
    void addButton

    wrapper.unmount()
  })
})
