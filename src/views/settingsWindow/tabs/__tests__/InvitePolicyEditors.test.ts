import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent } from 'vue'
import InvitePermissionPanel from '@/components/settings/InvitePermissionPanel.vue'
import BlockedUsersSection from '../sections/BlockedUsersSection.vue'

/**
 * `SecuritySettings.vue` 同时挂载这两个组件（:26 与 :31），它们各自读写同一份
 * `im.hula.invite_policy` account data。
 *
 * 评审 Important #2 的复现：在 `BlockedUsersSection` 屏蔽 @A，再去面板点
 * "黑名单模式" —— 面板 `handleModeChange` 用挂载时快照（blocklist 为空）整份
 * 写回，@A 被静默解除屏蔽。这里在两个真实组件之间做端到端回归。
 */
const { invitePolicyState } = vi.hoisted(() => ({
  invitePolicyState: {
    mode: 'allow_all',
    blocklist: [] as string[],
    allowlist: [] as string[],
    allowStrangers: false,
    contacts: [] as string[]
  }
}))

vi.mock('@/services/matrix', () => ({
  matrixAccountService: {
    getInvitePolicy: async () => ({
      ...invitePolicyState,
      blocklist: [...invitePolicyState.blocklist],
      allowlist: [...invitePolicyState.allowlist]
    }),
    setInvitePolicy: async (policy: typeof invitePolicyState) => {
      Object.assign(invitePolicyState, policy)
      return true
    }
  }
}))

vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }))

vi.mock('naive-ui', async () => {
  const { defineComponent, h } = await import('vue')

  const passthrough = (name: string) =>
    defineComponent({
      name,
      setup(_, { slots }) {
        return () => h('div', slots.default?.())
      }
    })

  return {
    NButton: defineComponent({
      name: 'NButton',
      setup(_, { slots }) {
        return () => h('button', slots.default?.())
      }
    }),
    NInput: defineComponent({
      name: 'NInput',
      props: { value: { type: String, default: '' } },
      emits: ['update:value'],
      setup(props, { emit }) {
        return () =>
          h('input', {
            value: props.value,
            onInput: (event: Event) => emit('update:value', (event.target as HTMLInputElement).value)
          })
      }
    }),
    NRadioGroup: passthrough('NRadioGroup'),
    NSwitch: passthrough('NSwitch'),
    NEmpty: passthrough('NEmpty'),
    NForm: passthrough('NForm'),
    NFormItem: passthrough('NFormItem'),
    NModal: passthrough('NModal'),
    NSpin: passthrough('NSpin'),
    NRadio: passthrough('NRadio'),
    NList: passthrough('NList'),
    NListItem: passthrough('NListItem'),
    NTag: passthrough('NTag')
  }
})

const Host = defineComponent({
  components: { BlockedUsersSection, InvitePermissionPanel },
  template: '<div><BlockedUsersSection /><InvitePermissionPanel /></div>'
})

type BlockedVm = {
  newBlockedUser: string
  handleAddBlocked: () => Promise<boolean>
  handleUnblock: (id: string) => Promise<void>
}

type PanelVm = {
  blocklistInput: string
  handleModeChange: (mode: string) => Promise<void>
  handleAddUser: (listType: 'blocklist' | 'allowlist') => Promise<void>
}

const blockedVm = (wrapper: ReturnType<typeof mount>) =>
  wrapper.findComponent(BlockedUsersSection).vm as unknown as BlockedVm
const panelVm = (wrapper: ReturnType<typeof mount>) =>
  wrapper.findComponent(InvitePermissionPanel).vm as unknown as PanelVm

describe('邀请策略双编辑器（SecuritySettings 同时挂载）', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    invitePolicyState.mode = 'allow_all'
    invitePolicyState.blocklist = []
    invitePolicyState.allowlist = []
    invitePolicyState.allowStrangers = false
    invitePolicyState.contacts = []
  })

  it('在 BlockedUsersSection 加的屏蔽，不会被面板随后的模式切换覆盖', async () => {
    const wrapper = mount(Host)
    await flushPromises()

    const blocked = blockedVm(wrapper)
    blocked.newBlockedUser = '@a:evil.org'
    await blocked.handleAddBlocked()
    await flushPromises()
    expect(invitePolicyState.blocklist).toEqual(['@a:evil.org'])

    await panelVm(wrapper).handleModeChange('blocklist')
    await flushPromises()

    // 旧实现：面板用挂载时的空快照整份写回 → blocklist 变回 []
    expect(invitePolicyState.blocklist).toEqual(['@a:evil.org'])
    expect(invitePolicyState.mode).toBe('blocklist')
  })

  it('面板加的屏蔽，不会被 BlockedUsersSection 随后的写回覆盖', async () => {
    const wrapper = mount(Host)
    await flushPromises()

    const panel = panelVm(wrapper)
    panel.blocklistInput = '@b:evil.org'
    await panel.handleAddUser('blocklist')
    await flushPromises()
    expect(invitePolicyState.blocklist).toEqual(['@b:evil.org'])

    const blocked = blockedVm(wrapper)
    blocked.newBlockedUser = '@c:evil.org'
    await blocked.handleAddBlocked()
    await flushPromises()

    expect(invitePolicyState.blocklist).toEqual(['@b:evil.org', '@c:evil.org'])
  })

  it('一边取消屏蔽，另一边刚加的人仍然保留', async () => {
    invitePolicyState.blocklist = ['@keep:evil.org']
    const wrapper = mount(Host)
    await flushPromises()

    const panel = panelVm(wrapper)
    panel.blocklistInput = '@added:evil.org'
    await panel.handleAddUser('blocklist')
    await flushPromises()

    await blockedVm(wrapper).handleUnblock('@keep:evil.org')
    await flushPromises()

    expect(invitePolicyState.blocklist).toEqual(['@added:evil.org'])
  })
})
