import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import FeatureFlagManager from '../FeatureFlagManager.vue'

type FeatureFlagManagerVm = {
  openCreateDialog: () => void
  openEditDialog: (flag: Record<string, unknown>) => Promise<void>
  handleSubmit: () => Promise<void>
  handleDelete: (flagKey: string) => Promise<void>
  addTarget: () => void
  formData: {
    flagKey: string
    description: string
    enabled: boolean
    targetScope: string
    rolloutPercent: number
    expiresAt: number | null
    reason: string
    targets: Array<{ subjectType: string; subjectId: string }>
  }
}

const {
  loadFeatureFlagsMock,
  getFeatureFlagDetailMock,
  saveFeatureFlagMock,
  deleteFeatureFlagMock,
  showFeedbackMock,
  featureFlagsState
} = vi.hoisted(() => ({
  loadFeatureFlagsMock: vi.fn(),
  getFeatureFlagDetailMock: vi.fn(),
  saveFeatureFlagMock: vi.fn(),
  deleteFeatureFlagMock: vi.fn(),
  showFeedbackMock: vi.fn(),
  featureFlagsState: [
    {
      flagKey: 'flag-a',
      enabled: true,
      status: 'enabled',
      description: 'flag a desc',
      targetScope: 'tenant',
      rolloutPercent: 30,
      expiresAt: null,
      reason: 'desc',
      createdBy: '@admin:server',
      createdTs: 1,
      updatedTs: 2,
      targets: [{ subjectType: 'tenant', subjectId: 'tenant-a' }]
    }
  ]
}))

vi.mock('@/composables/admin', () => ({
  useAdminMaintenance: () => {
    const { ref } = require('vue') as typeof import('vue')
    return {
      featureFlags: ref(featureFlagsState),
      loading: ref(false),
      featureSaving: ref(false),
      loadFeatureFlags: loadFeatureFlagsMock,
      getFeatureFlagDetail: getFeatureFlagDetailMock,
      saveFeatureFlag: saveFeatureFlagMock,
      deleteFeatureFlag: deleteFeatureFlagMock
    }
  }
}))

vi.mock('@/composables/common/useActionFeedback', () => ({
  useActionFeedback: () => ({
    showFeedback: showFeedbackMock
  })
}))

vi.mock('@/utils/Logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  })
}))

vi.mock('@iconify/vue', () => ({
  Icon: {
    name: 'Icon',
    template: '<i />'
  }
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key
  })
}))

vi.mock('naive-ui', async () => {
  const { defineComponent, h } = await import('vue')

  const passthrough = (name: string) =>
    defineComponent({
      name,
      props: [
        'value',
        'show',
        'model',
        'options',
        'loading',
        'pagination',
        'data',
        'columns',
        'expandable',
        'expandedRowKeys'
      ],
      emits: ['update:show', 'update:value', 'update:expanded-row-keys'],
      setup(props, { slots, emit }) {
        return () =>
          h(
            'div',
            {
              'data-test': name,
              onClick: () => emit('update:value', !(props as any).value)
            },
            slots.default?.()
          )
      }
    })

  return {
    NButton: defineComponent({
      name: 'NButton',
      emits: ['click'],
      setup(_, { slots, emit }) {
        return () => h('button', { type: 'button', onClick: () => emit('click') }, slots.default?.())
      }
    }),
    NDataTable: passthrough('NDataTable'),
    NDatePicker: passthrough('NDatePicker'),
    NDescriptions: passthrough('NDescriptions'),
    NDescriptionsItem: passthrough('NDescriptionsItem'),
    NFlex: passthrough('NFlex'),
    NForm: passthrough('NForm'),
    NFormItem: passthrough('NFormItem'),
    NInput: passthrough('NInput'),
    NInputNumber: passthrough('NInputNumber'),
    NModal: defineComponent({
      name: 'NModal',
      props: ['show', 'title'],
      emits: ['update:show'],
      setup(props, { slots }) {
        return () => ((props as any).show ? h('div', { 'data-test': 'modal' }, slots.default?.()) : null)
      }
    }),
    NPopconfirm: passthrough('NPopconfirm'),
    NSelect: passthrough('NSelect'),
    NSpace: passthrough('NSpace'),
    NSwitch: passthrough('NSwitch'),
    NTag: passthrough('NTag')
  }
})

describe('FeatureFlagManager', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    loadFeatureFlagsMock.mockResolvedValue(undefined)
    getFeatureFlagDetailMock.mockResolvedValue({
      flagKey: 'flag-a',
      enabled: true,
      status: 'enabled',
      description: 'detail desc',
      targetScope: 'tenant',
      rolloutPercent: 30,
      expiresAt: 123,
      reason: 'detail reason',
      createdBy: '@admin:server',
      createdTs: 1,
      updatedTs: 2,
      targets: [{ subjectType: 'tenant', subjectId: 'tenant-a' }]
    })
    saveFeatureFlagMock.mockResolvedValue(undefined)
    deleteFeatureFlagMock.mockResolvedValue(undefined)
  })

  const mountComponent = () => mount(FeatureFlagManager)

  it('挂载时加载 Feature Flags 列表', async () => {
    mountComponent()
    await flushPromises()

    expect(loadFeatureFlagsMock).toHaveBeenCalledTimes(1)
  })

  it('编辑时会加载详情并带出 targets', async () => {
    const wrapper = mountComponent()
    await flushPromises()

    await (wrapper.vm as unknown as FeatureFlagManagerVm).openEditDialog(featureFlagsState[0])

    expect(getFeatureFlagDetailMock).toHaveBeenCalledWith('flag-a')
    expect((wrapper.vm as unknown as FeatureFlagManagerVm).formData.targetScope).toBe('tenant')
    expect((wrapper.vm as unknown as FeatureFlagManagerVm).formData.targets).toEqual([
      { subjectType: 'tenant', subjectId: 'tenant-a' }
    ])
  })

  it('创建时会提交 tenant scope 与 targets', async () => {
    const wrapper = mountComponent()
    await flushPromises()

    ;(wrapper.vm as unknown as FeatureFlagManagerVm).openCreateDialog()
    const vm = wrapper.vm as unknown as FeatureFlagManagerVm
    vm.formData.flagKey = 'flag-new'
    vm.formData.description = 'new desc'
    vm.formData.targetScope = 'tenant'
    vm.formData.rolloutPercent = 80
    vm.formData.reason = ''
    vm.addTarget()
    vm.formData.targets[0] = { subjectType: 'tenant', subjectId: 'tenant-b' }

    await vm.handleSubmit()

    expect(saveFeatureFlagMock).toHaveBeenCalledWith({
      flagKey: 'flag-new',
      targetScope: 'tenant',
      rolloutPercent: 80,
      expiresAt: null,
      reason: 'new desc',
      targets: [{ subjectType: 'tenant', subjectId: 'tenant-b' }]
    })
    expect(showFeedbackMock).toHaveBeenCalledWith('admin.feature_flags.create_success', 'success')
  })

  it('删除时委托给维护 composable', async () => {
    const wrapper = mountComponent()
    await flushPromises()

    await (wrapper.vm as unknown as FeatureFlagManagerVm).handleDelete('flag-a')

    expect(deleteFeatureFlagMock).toHaveBeenCalledWith('flag-a')
    expect(showFeedbackMock).toHaveBeenCalledWith('admin.feature_flags.delete_success', 'success')
  })
})
