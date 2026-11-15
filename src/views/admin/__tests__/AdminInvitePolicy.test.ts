import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AdminInvitePolicy from '../AdminInvitePolicy.vue'

const { showFeedbackMock, composable } = vi.hoisted(() => ({
  showFeedbackMock: vi.fn(),
  composable: {
    loadLists: vi.fn().mockResolvedValue(true),
    saveBlocklist: vi.fn().mockResolvedValue(true),
    saveAllowlist: vi.fn().mockResolvedValue(true)
  }
}))

vi.mock('@/composables/admin', async () => {
  const { ref } = await import('vue')
  return {
    useAdminInvitePolicy: () => ({
      blocklist: ref(['@blocked:example.org']),
      allowlist: ref(['@allowed:example.org']),
      loading: ref(false),
      savingBlocklist: ref(false),
      savingAllowlist: ref(false),
      error: ref(null),
      ...composable
    })
  }
})

vi.mock('@/composables/common/useActionFeedback', () => ({
  useActionFeedback: () => ({ showFeedback: showFeedbackMock })
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key })
}))

vi.mock('naive-ui', async () => {
  const { defineComponent, h } = await import('vue')

  const passthrough = (name: string) =>
    defineComponent({
      name,
      props: ['title', 'type', 'label', 'description', 'bordered', 'size'],
      setup(props, { slots }) {
        return () =>
          h('div', { 'data-test': name }, [
            props.title ? h('span', String(props.title)) : null,
            props.description ? h('span', String(props.description)) : null,
            slots.default?.(),
            slots.extra?.(),
            slots['header-extra']?.()
          ])
      }
    })

  const input = () =>
    defineComponent({
      name: 'NInput',
      props: { value: { type: [String, Number], default: '' }, type: String, placeholder: String, rows: Number },
      emits: ['update:value'],
      setup(props, { emit }) {
        return () =>
          h(props.type === 'textarea' ? 'textarea' : 'input', {
            value: props.value,
            onInput: (event: Event) => emit('update:value', (event.target as HTMLInputElement).value)
          })
      }
    })

  return {
    NAlert: passthrough('NAlert'),
    NButton: defineComponent({
      name: 'NButton',
      props: ['loading', 'disabled', 'type'],
      emits: ['click'],
      setup(props, { slots, emit }) {
        return () =>
          h('button', { type: 'button', disabled: props.disabled, onClick: () => emit('click') }, slots.default?.())
      }
    }),
    NCard: passthrough('NCard'),
    NInput: input(),
    NSpace: passthrough('NSpace')
  }
})

describe('AdminInvitePolicy', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('未填写房间 ID 时拦截读取', async () => {
    const wrapper = mount(AdminInvitePolicy)

    await wrapper.find('[data-testid="admin-invite-policy-load"]').trigger('click')

    expect(showFeedbackMock).toHaveBeenCalledWith('admin.invitePolicy.roomIdRequired', 'error')
    expect(composable.loadLists).not.toHaveBeenCalled()
  })

  it('读取成功后回填黑白名单草稿', async () => {
    const wrapper = mount(AdminInvitePolicy)

    await wrapper.find('[data-testid="admin-invite-policy-room-id"]').setValue('!room:example.org')
    await wrapper.find('[data-testid="admin-invite-policy-load"]').trigger('click')
    await flushPromises()

    expect(composable.loadLists).toHaveBeenCalledWith('!room:example.org')
    expect((wrapper.find('[data-testid="admin-invite-policy-blocklist"]').element as HTMLInputElement).value).toBe(
      '@blocked:example.org'
    )
    expect((wrapper.find('[data-testid="admin-invite-policy-allowlist"]').element as HTMLInputElement).value).toBe(
      '@allowed:example.org'
    )
  })

  it('保存黑名单时按行拆分并过滤空行', async () => {
    const wrapper = mount(AdminInvitePolicy)

    await wrapper.find('[data-testid="admin-invite-policy-room-id"]').setValue('!room:example.org')
    await wrapper.find('[data-testid="admin-invite-policy-blocklist"]').setValue('@a:example.org\n\n@b:example.org ')
    await wrapper.find('[data-testid="admin-invite-policy-blocklist-save"]').trigger('click')
    await flushPromises()

    expect(composable.saveBlocklist).toHaveBeenCalledWith('!room:example.org', ['@a:example.org', '@b:example.org'])
    expect(showFeedbackMock).toHaveBeenCalledWith('admin.invitePolicy.blocklistSaved', 'success')
  })

  it('保存白名单失败时提示失败', async () => {
    composable.saveAllowlist.mockResolvedValueOnce(false)
    const wrapper = mount(AdminInvitePolicy)

    await wrapper.find('[data-testid="admin-invite-policy-room-id"]').setValue('!room:example.org')
    await wrapper.find('[data-testid="admin-invite-policy-allowlist-save"]').trigger('click')
    await flushPromises()

    expect(showFeedbackMock).toHaveBeenCalledWith('admin.invitePolicy.saveFailed', 'error')
  })
})
