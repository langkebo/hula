import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AdminCleanup from '../AdminCleanup.vue'

const { showFeedbackMock, dialogMock, composable, state } = vi.hoisted(() => ({
  showFeedbackMock: vi.fn(),
  dialogMock: { error: vi.fn() },
  composable: {
    runCleanupAll: vi.fn().mockResolvedValue(true),
    runCleanupRooms: vi.fn().mockResolvedValue(true),
    runCleanupTokens: vi.fn().mockResolvedValue(true)
  },
  state: {} as { outcome?: import('vue').Ref<unknown> }
}))

vi.mock('@/composables/admin', async () => {
  const { ref } = await import('vue')
  const outcome = ref<unknown>(null)
  state.outcome = outcome
  return {
    useAdminCleanup: () => ({
      running: ref(false),
      error: ref(null),
      outcome,
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
      props: ['title', 'type', 'label', 'description', 'bordered', 'column', 'size', 'labelPlacement'],
      setup(props, { slots }) {
        return () =>
          h('div', { 'data-test': name }, [
            props.title ? h('span', String(props.title)) : null,
            props.label ? h('span', String(props.label)) : null,
            props.description ? h('span', String(props.description)) : null,
            slots.default?.()
          ])
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
    NDescriptions: passthrough('NDescriptions'),
    NDescriptionsItem: passthrough('NDescriptionsItem'),
    NInputNumber: defineComponent({
      name: 'NInputNumber',
      props: { value: { type: [Number, null], default: null }, min: Number, max: Number, placeholder: String },
      emits: ['update:value'],
      setup(props, { emit }) {
        return () =>
          h('input', {
            type: 'number',
            value: props.value,
            onInput: (event: Event) => emit('update:value', Number((event.target as HTMLInputElement).value))
          })
      }
    }),
    NSpace: passthrough('NSpace'),
    useDialog: () => dialogMock
  }
})

describe('AdminCleanup', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    if (state.outcome) {
      state.outcome.value = null
    }
  })

  it('渲染三个清理动作与风险提示', async () => {
    const wrapper = mount(AdminCleanup)
    await flushPromises()

    expect(wrapper.text()).toContain('admin.cleanup.hint')
    expect(wrapper.text()).toContain('admin.cleanup.all.title')
    expect(wrapper.text()).toContain('admin.cleanup.rooms.title')
    expect(wrapper.text()).toContain('admin.cleanup.tokens.title')
  })

  it('全部清理需二次确认，确认后不传最小年龄', async () => {
    const wrapper = mount(AdminCleanup)
    await flushPromises()

    await wrapper.find('[data-testid="admin-cleanup-run-all"]').trigger('click')

    expect(dialogMock.error).toHaveBeenCalledTimes(1)
    const options = dialogMock.error.mock.calls[0][0]
    await options.onPositiveClick()

    expect(composable.runCleanupAll).toHaveBeenCalledWith(undefined)
    expect(showFeedbackMock).toHaveBeenCalledWith('admin.cleanup.all.success', 'success')
  })

  it('填写最小年龄后房间清理透传该值', async () => {
    const wrapper = mount(AdminCleanup)
    await flushPromises()

    await wrapper.find('[data-testid="admin-cleanup-min-age"]').setValue('1000')
    await wrapper.find('[data-testid="admin-cleanup-run-rooms"]').trigger('click')

    const options = dialogMock.error.mock.calls[0][0]
    await options.onPositiveClick()

    expect(composable.runCleanupRooms).toHaveBeenCalledWith(1000)
  })

  it('按结果类型展示令牌清理统计', async () => {
    state.outcome!.value = {
      kind: 'tokens',
      result: { access_tokens_deleted: 7, refresh_tokens_deleted: 8 }
    }

    const wrapper = mount(AdminCleanup)
    await flushPromises()

    const result = wrapper.find('[data-testid="admin-cleanup-result"]')
    expect(result.exists()).toBe(true)
    expect(result.text()).toContain('admin.cleanup.result.accessTokens')
    expect(result.text()).toContain('7')
    expect(result.text()).toContain('8')
  })
})
