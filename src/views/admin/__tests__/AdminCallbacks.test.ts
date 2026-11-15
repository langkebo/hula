import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AdminCallbacks from '../AdminCallbacks.vue'

const { showFeedbackMock, composable } = vi.hoisted(() => ({
  showFeedbackMock: vi.fn(),
  composable: {
    loadMediaCallbacks: vi.fn().mockResolvedValue(undefined),
    createMediaCallback: vi.fn().mockResolvedValue(true),
    loadAccountDataCallbacks: vi.fn().mockResolvedValue(undefined),
    createAccountDataCallback: vi.fn().mockResolvedValue(true)
  }
}))

vi.mock('@/composables/admin', async () => {
  const { ref } = await import('vue')
  return {
    useAdminCallbacks: () => ({
      mediaCallbacks: ref([
        {
          id: 1,
          callback_type: 'thumbnail',
          media_id: 'm1',
          user_id: '@alice:example.org',
          status: 'success',
          result: { ok: true },
          created_ts: 1700000000,
          completed_ts: 1700000001,
          is_enabled: true
        }
      ]),
      mediaLoading: ref(false),
      mediaSaving: ref(false),
      mediaError: ref(null),
      accountDataCallbacks: ref([
        {
          id: 2,
          callback_name: 'account-sync',
          is_enabled: true,
          data_types: ['m.direct'],
          config: { url: 'https://example.com/hook' },
          created_ts: 1700000000
        }
      ]),
      accountDataLoading: ref(false),
      accountDataSaving: ref(false),
      accountDataError: ref(null),
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
      props: ['title', 'type', 'label', 'description', 'bordered', 'column', 'size', 'labelPlacement', 'tab'],
      setup(props, { slots }) {
        return () =>
          h('div', { 'data-test': name }, [
            props.title ? h('span', String(props.title)) : null,
            props.tab ? h('span', String(props.tab)) : null,
            props.label ? h('span', String(props.label)) : null,
            props.description ? h('span', String(props.description)) : null,
            slots.default?.(),
            slots.extra?.()
          ])
      }
    })

  const input = (name: string) =>
    defineComponent({
      name,
      props: { value: { type: [String, Number], default: '' }, type: String, placeholder: String, rows: Number },
      emits: ['update:value'],
      setup(props, { emit }) {
        return () =>
          props.type === 'textarea'
            ? h('textarea', {
                value: props.value,
                onInput: (event: Event) => emit('update:value', (event.target as HTMLTextAreaElement).value)
              })
            : h('input', {
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
    NDataTable: defineComponent({
      name: 'NDataTable',
      props: ['data', 'columns', 'loading', 'rowKey', 'scrollX'],
      setup(props) {
        return () => h('div', { 'data-test': 'NDataTable' }, JSON.stringify(props.data ?? []))
      }
    }),
    NEmpty: passthrough('NEmpty'),
    NForm: passthrough('NForm'),
    NFormItem: passthrough('NFormItem'),
    NInput: input('NInput'),
    NInputNumber: input('NInputNumber'),
    NTabPane: passthrough('NTabPane'),
    NTabs: passthrough('NTabs'),
    NSwitch: defineComponent({
      name: 'NSwitch',
      props: ['value'],
      emits: ['update:value'],
      setup(props, { emit }) {
        return () =>
          h('button', {
            type: 'button',
            'data-value': String(props.value),
            onClick: () => emit('update:value', !props.value)
          })
      }
    }),
    NSpace: passthrough('NSpace'),
    NTag: passthrough('NTag')
  }
})

describe('AdminCallbacks', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('渲染两个回调分组与已有记录', async () => {
    const wrapper = mount(AdminCallbacks)
    await flushPromises()

    expect(wrapper.text()).toContain('admin.callbacks.tabs.media')
    expect(wrapper.text()).toContain('admin.callbacks.tabs.accountData')
    expect(wrapper.text()).toContain('thumbnail')
    expect(wrapper.text()).toContain('account-sync')
    expect(composable.loadMediaCallbacks).toHaveBeenCalledWith()
    expect(composable.loadAccountDataCallbacks).toHaveBeenCalledWith()
  })

  it('媒体回调缺少名称时提示必填', async () => {
    const wrapper = mount(AdminCallbacks)
    await flushPromises()

    await wrapper.find('[data-testid="admin-callbacks-media-submit"]').trigger('click')

    expect(showFeedbackMock).toHaveBeenCalledWith('admin.callbacks.media.requiredName', 'error')
    expect(composable.createMediaCallback).not.toHaveBeenCalled()
  })

  it('填写完整后提交媒体回调', async () => {
    const wrapper = mount(AdminCallbacks)
    await flushPromises()

    await wrapper.find('[data-testid="admin-callbacks-media-name"]').setValue('media-thumbnail')
    await wrapper.find('[data-testid="admin-callbacks-media-type"]').setValue('thumbnail')
    await wrapper.find('[data-testid="admin-callbacks-media-url"]').setValue('https://example.com/hook')
    await wrapper.find('[data-testid="admin-callbacks-media-submit"]').trigger('click')
    await flushPromises()

    expect(composable.createMediaCallback).toHaveBeenCalledWith({
      callbackName: 'media-thumbnail',
      callbackType: 'thumbnail',
      url: 'https://example.com/hook',
      method: 'POST',
      timeoutMs: 5000,
      retryCount: 0,
      isEnabled: true
    })
    expect(showFeedbackMock).toHaveBeenCalledWith('admin.callbacks.media.success', 'success')
  })

  it('账户数据回调配置非法 JSON 时拦截提交', async () => {
    const wrapper = mount(AdminCallbacks)
    await flushPromises()

    await wrapper.find('[data-testid="admin-callbacks-account-name"]').setValue('account-sync')
    await wrapper.find('[data-testid="admin-callbacks-account-config"]').setValue('not-json')
    await wrapper.find('[data-testid="admin-callbacks-account-submit"]').trigger('click')

    expect(showFeedbackMock).toHaveBeenCalledWith('admin.callbacks.accountData.invalidConfig', 'error')
    expect(composable.createAccountDataCallback).not.toHaveBeenCalled()
  })
})
