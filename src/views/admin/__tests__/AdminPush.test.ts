import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AdminPush from '../AdminPush.vue'

const { showFeedbackMock, dialogMock, composable } = vi.hoisted(() => ({
  showFeedbackMock: vi.fn(),
  dialogMock: { warning: vi.fn() },
  composable: {
    loadConfig: vi.fn().mockResolvedValue(undefined),
    saveConfig: vi.fn().mockResolvedValue(true),
    processQueue: vi.fn().mockResolvedValue(true),
    cleanupLogs: vi.fn().mockResolvedValue(true)
  }
}))

vi.mock('@/composables/admin', async () => {
  const { ref } = await import('vue')
  return {
    useAdminPush: () => ({
      config: ref({
        config: { poll_timeout: '30', apns_secret: '***' },
        initialized_providers: ['apns'],
        supported_keys: ['poll_timeout', 'apns_secret']
      }),
      configLoading: ref(false),
      configSaving: ref(false),
      configError: ref(null),
      processing: ref(false),
      processResult: ref(null),
      processError: ref(null),
      cleaning: ref(false),
      cleanupResult: ref(null),
      cleanupError: ref(null),
      ...composable
    })
  }
})

vi.mock('@/composables/common/useActionFeedback', () => ({
  useActionFeedback: () => ({ showFeedback: showFeedbackMock })
}))

vi.mock('@/utils/Logger', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })
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
          h('input', {
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
    NInput: input(),
    NInputNumber: defineComponent({
      name: 'NInputNumber',
      props: { value: { type: [Number, null], default: null }, min: Number, max: Number },
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
    NTag: passthrough('NTag'),
    useDialog: () => dialogMock
  }
})

describe('AdminPush', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('渲染配置项与已初始化提供方', async () => {
    const wrapper = mount(AdminPush)
    await flushPromises()

    expect(composable.loadConfig).toHaveBeenCalledTimes(1)
    expect(wrapper.text()).toContain('poll_timeout')
    expect(wrapper.text()).toContain('apns')
    expect(wrapper.text()).toContain('admin.push.supportedKeys')
  })

  it('按键提交配置补丁', async () => {
    const wrapper = mount(AdminPush)
    await flushPromises()

    await wrapper.find('[data-testid="admin-push-patch-key"]').setValue('poll_timeout')
    await wrapper.find('[data-testid="admin-push-patch-value"]').setValue('60')
    await wrapper.find('[data-testid="admin-push-patch-submit"]').trigger('click')
    await flushPromises()

    expect(composable.saveConfig).toHaveBeenCalledWith({ config: { poll_timeout: '60' } })
    expect(showFeedbackMock).toHaveBeenCalledWith('admin.push.patchSuccess', 'success')
  })

  it('值为空时提交 null 以清除该键', async () => {
    const wrapper = mount(AdminPush)
    await flushPromises()

    await wrapper.find('[data-testid="admin-push-patch-key"]').setValue('apns_secret')
    await wrapper.find('[data-testid="admin-push-patch-submit"]').trigger('click')
    await flushPromises()

    expect(composable.saveConfig).toHaveBeenCalledWith({ config: { apns_secret: null } })
  })

  it('配置键为空时拦截提交', async () => {
    const wrapper = mount(AdminPush)
    await flushPromises()

    await wrapper.find('[data-testid="admin-push-patch-submit"]').trigger('click')

    expect(showFeedbackMock).toHaveBeenCalledWith('admin.push.requiredKey', 'error')
    expect(composable.saveConfig).not.toHaveBeenCalled()
  })

  it('消费队列透传批量大小', async () => {
    const wrapper = mount(AdminPush)
    await flushPromises()

    await wrapper.find('[data-testid="admin-push-process-batch"]').setValue('50')
    await wrapper.find('[data-testid="admin-push-process-submit"]').trigger('click')
    await flushPromises()

    expect(composable.processQueue).toHaveBeenCalledWith(50)
  })

  it('清理日志需二次确认，确认后按保留天数执行', async () => {
    const wrapper = mount(AdminPush)
    await flushPromises()

    await wrapper.find('[data-testid="admin-push-cleanup-submit"]').trigger('click')

    expect(dialogMock.warning).toHaveBeenCalledTimes(1)
    const options = dialogMock.warning.mock.calls[0][0]
    await options.onPositiveClick()

    expect(composable.cleanupLogs).toHaveBeenCalledWith(30)
    expect(showFeedbackMock).toHaveBeenCalledWith('admin.push.cleanupSuccess', 'success')
  })
})
