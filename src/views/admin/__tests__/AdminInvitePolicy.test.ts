import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AdminInvitePolicy from '../AdminInvitePolicy.vue'
import { makeImportGlobalUsersResult } from './fixtures/invitePolicy'

const { showFeedbackMock, composable } = vi.hoisted(() => ({
  showFeedbackMock: vi.fn(),
  composable: {
    loadLists: vi.fn().mockResolvedValue(true),
    saveBlocklist: vi.fn().mockResolvedValue(true),
    saveAllowlist: vi.fn().mockResolvedValue(true),
    loadGlobalLists: vi.fn().mockResolvedValue(true),
    addGlobalUser: vi.fn().mockResolvedValue(true),
    removeGlobalUser: vi.fn().mockResolvedValue(true),
    importGlobalUsers: vi.fn().mockResolvedValue({ success: 2, failed: 0 }),
    replaceGlobalUsers: vi.fn().mockResolvedValue(true)
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
      globalAllowlist: ref(['@global-allowed:example.org']),
      globalBlocklist: ref(['@global-blocked:example.org']),
      globalLoading: ref(false),
      globalMutating: ref(false),
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
    NEmpty: passthrough('NEmpty'),
    NGrid: passthrough('NGrid'),
    NGridItem: passthrough('NGridItem'),
    NInput: input(),
    NPopconfirm: defineComponent({
      name: 'NPopconfirm',
      emits: ['positive-click'],
      setup(_, { slots, emit }) {
        return () =>
          h('span', { 'data-test': 'NPopconfirm' }, [
            slots.trigger?.(),
            h('button', {
              type: 'button',
              'data-test': 'popconfirm-positive',
              onClick: () => emit('positive-click')
            })
          ])
      }
    }),
    NSpace: passthrough('NSpace'),
    NSpin: passthrough('NSpin'),
    NTag: passthrough('NTag')
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

  it('添加全局名单用户成功后清空输入并提示', async () => {
    const wrapper = mount(AdminInvitePolicy)
    const inputEl = wrapper.find('[data-testid="admin-invite-policy-global-add-input-allowlist"]')

    await inputEl.setValue('@new:example.org')
    await wrapper.find('[data-testid="admin-invite-policy-global-add-allowlist"]').trigger('click')
    await flushPromises()

    expect(composable.addGlobalUser).toHaveBeenCalledWith('allowlist', '@new:example.org')
    expect((inputEl.element as HTMLInputElement).value).toBe('')
    expect(showFeedbackMock).toHaveBeenCalledWith('admin.invitePolicy.globalAddSuccess', 'success')
  })

  it('粘贴批量导入按行拆分并提示导入统计', async () => {
    composable.importGlobalUsers.mockResolvedValueOnce(makeImportGlobalUsersResult(2, 1))
    const wrapper = mount(AdminInvitePolicy)

    await wrapper
      .find('[data-testid="admin-invite-policy-global-import-input-blocklist"]')
      .setValue('@a:example.org\n@b:example.org\n@c:example.org')
    await wrapper.find('[data-testid="admin-invite-policy-global-import-blocklist"]').trigger('click')
    await flushPromises()

    expect(composable.importGlobalUsers).toHaveBeenCalledWith('blocklist', [
      '@a:example.org',
      '@b:example.org',
      '@c:example.org'
    ])
    expect(showFeedbackMock).toHaveBeenCalledWith('admin.invitePolicy.bulkImportResult', 'warning')
  })

  it('确认整体替换后按行提交全局白名单', async () => {
    const wrapper = mount(AdminInvitePolicy)

    await wrapper
      .find('[data-testid="admin-invite-policy-global-import-input-allowlist"]')
      .setValue('@a:example.org\n@b:example.org\n@a:example.org ')
    const confirms = wrapper.findAll('[data-test="popconfirm-positive"]')
    expect(confirms).toHaveLength(2)
    await confirms[0].trigger('click')
    await flushPromises()

    expect(composable.replaceGlobalUsers).toHaveBeenCalledWith('allowlist', [
      '@a:example.org',
      '@b:example.org',
      '@a:example.org'
    ])
    expect(showFeedbackMock).toHaveBeenCalledWith('admin.invitePolicy.globalReplaceSuccess', 'success')
  })

  it('整体替换全局黑名单失败时提示失败', async () => {
    composable.replaceGlobalUsers.mockResolvedValueOnce(false)
    const wrapper = mount(AdminInvitePolicy)

    await wrapper
      .find('[data-testid="admin-invite-policy-global-import-input-blocklist"]')
      .setValue('@blocked:example.org')
    await wrapper.findAll('[data-test="popconfirm-positive"]')[1].trigger('click')
    await flushPromises()

    expect(composable.replaceGlobalUsers).toHaveBeenCalledWith('blocklist', ['@blocked:example.org'])
    expect(showFeedbackMock).toHaveBeenCalledWith('admin.invitePolicy.globalReplaceFailed', 'error')
  })

  it('挂载时读取全局名单', async () => {
    mount(AdminInvitePolicy)
    await flushPromises()

    expect(composable.loadGlobalLists).toHaveBeenCalledTimes(1)
  })
})
