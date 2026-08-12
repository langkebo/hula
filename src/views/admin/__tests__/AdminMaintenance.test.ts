import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import AdminMaintenance from '../AdminMaintenance.vue'

const { loadAllMock, purgeMediaCacheMock, setExperimentalFeatureMock, showFeedbackMock, state } = vi.hoisted(() => ({
  loadAllMock: vi.fn(),
  purgeMediaCacheMock: vi.fn(),
  setExperimentalFeatureMock: vi.fn(),
  showFeedbackMock: vi.fn(),
  state: {
    backups: [] as Array<Record<string, unknown>>,
    mediaStats: null as Record<string, unknown> | null,
    experimentalFeatures: {} as Record<string, unknown>,
    loading: false,
    purging: false,
    featureMutating: false
  }
}))

vi.mock('@/composables/admin', () => ({
  useAdminMaintenance: () => ({
    backups: ref(state.backups),
    mediaStats: ref(state.mediaStats),
    experimentalFeatures: ref(state.experimentalFeatures),
    loading: ref(state.loading),
    purging: ref(state.purging),
    featureMutating: ref(state.featureMutating),
    loadAll: loadAllMock,
    purgeMediaCache: purgeMediaCacheMock,
    setExperimentalFeature: setExperimentalFeatureMock
  })
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

// stub 重度服务图谱子组件，避免引入真实 FeatureFlagManager 的依赖链
vi.mock('@/components/admin/FeatureFlagManager.vue', () => ({
  default: {
    name: 'FeatureFlagManager',
    template: '<div data-test="FeatureFlagManager" />'
  }
}))

vi.mock('naive-ui', async () => {
  const { defineComponent, h } = await import('vue')

  const passthrough = (name: string, tag = 'div') =>
    defineComponent({
      name,
      props: [
        'show',
        'title',
        'subtitle',
        'cols',
        'xGap',
        'yGap',
        'responsive',
        'itemResponsive',
        'span',
        'size',
        'bordered',
        'column',
        'description',
        'value',
        'type',
        'animated',
        'name',
        'tab',
        'align',
        'justify',
        'loading'
      ],
      setup(props, { slots }) {
        return () =>
          h(tag, { 'data-test': name }, [
            props.title ? h('span', { 'data-test': `${name}-title` }, String(props.title)) : null,
            props.description ? h('span', String(props.description)) : null,
            slots.default?.(),
            slots.extra?.(),
            slots.action?.()
          ])
      }
    })

  return {
    NButton: defineComponent({
      name: 'NButton',
      props: ['loading', 'type'],
      emits: ['click'],
      setup(_, { slots, emit }) {
        return () => h('button', { type: 'button', onClick: () => emit('click') }, slots.default?.())
      }
    }),
    NCard: passthrough('NCard'),
    NDataTable: defineComponent({
      name: 'NDataTable',
      props: ['data', 'columns', 'pagination', 'bordered', 'size'],
      setup(props) {
        return () => h('div', { 'data-test': 'NDataTable' }, JSON.stringify(props.data ?? []))
      }
    }),
    NDatePicker: defineComponent({
      name: 'NDatePicker',
      props: ['value', 'type', 'clearable', 'placeholder'],
      emits: ['update:value'],
      setup() {
        return () => h('input', { 'data-test': 'NDatePicker', type: 'text' })
      }
    }),
    NDescriptions: passthrough('NDescriptions'),
    NDescriptionsItem: defineComponent({
      name: 'NDescriptionsItem',
      props: ['label'],
      setup(props, { slots }) {
        return () =>
          h('div', { 'data-test': 'NDescriptionsItem' }, [
            props.label ? h('span', { 'data-test': 'NDescriptionsItem-label' }, String(props.label)) : null,
            slots.default?.()
          ])
      }
    }),
    NEmpty: passthrough('NEmpty'),
    NFlex: passthrough('NFlex'),
    NGi: passthrough('NGi'),
    NGrid: passthrough('NGrid'),
    NList: passthrough('NList'),
    NListItem: passthrough('NListItem'),
    NPageHeader: passthrough('NPageHeader'),
    NSpace: passthrough('NSpace'),
    NSwitch: defineComponent({
      name: 'NSwitch',
      props: ['value', 'loading'],
      emits: ['update:value'],
      setup(props, { emit }) {
        return () =>
          h('input', {
            'data-test': 'NSwitch',
            type: 'checkbox',
            checked: props.value,
            onChange: (e: Event) => emit('update:value', (e.target as HTMLInputElement).checked)
          })
      }
    }),
    NTabPane: passthrough('NTabPane'),
    NTabs: passthrough('NTabs'),
    NTag: defineComponent({
      name: 'NTag',
      props: ['size', 'type'],
      setup(_, { slots }) {
        return () => h('span', { 'data-test': 'NTag' }, slots.default?.())
      }
    })
  }
})

describe('AdminMaintenance', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    state.backups = [{ id: 'backup-1', size: '1.2GB', created_at: 1700000000000, status: 'completed' }]
    state.mediaStats = { cacheSize: '2.4GB', fileCount: 1200 }
    state.experimentalFeatures = {
      'labs.feature_a': true,
      'labs.feature_b': { enabled: false, description: 'Feature B desc' }
    }
    state.loading = false
    state.purging = false
    state.featureMutating = false
    loadAllMock.mockResolvedValue(undefined)
    purgeMediaCacheMock.mockResolvedValue({ deleted: 5 })
    setExperimentalFeatureMock.mockResolvedValue(undefined)
  })

  const mountComponent = () => mount(AdminMaintenance)

  it('挂载时加载维护信息', async () => {
    mountComponent()
    await flushPromises()

    expect(loadAllMock).toHaveBeenCalledTimes(1)
  })

  it('渲染媒体缓存统计', async () => {
    const wrapper = mountComponent()
    await flushPromises()

    expect(wrapper.text()).toContain('cacheSize')
    expect(wrapper.text()).toContain('2.4GB')
  })

  it('渲染备份列表到表格', async () => {
    const wrapper = mountComponent()
    await flushPromises()

    const table = wrapper.findComponent({ name: 'NDataTable' })
    expect(table.exists()).toBe(true)
    expect(table.text()).toContain('backup-1')
  })

  it('切换到简单特性页签时渲染实验特性列表', async () => {
    const wrapper = mountComponent()
    await flushPromises()

    // featureTab 默认是 'advanced'，组件内 tab 初始为 advanced
    // 通过直接检查 featureEntries 计算结果验证（NTabPane passthrough 会渲染所有 slot）
    expect(wrapper.text()).toContain('labs.feature_a')
    expect(wrapper.text()).toContain('labs.feature_b')
    expect(wrapper.text()).toContain('Feature B desc')
  })

  it('点击清理按钮调用 purgeMediaCache 并展示删除数量', async () => {
    const wrapper = mountComponent()
    await flushPromises()

    const purgeButton = wrapper.findAll('button').find((b) => b.text().includes('admin.maintenance.purge'))
    await purgeButton!.trigger('click')
    await flushPromises()

    expect(purgeMediaCacheMock).toHaveBeenCalledWith(undefined)
    expect(showFeedbackMock).toHaveBeenCalledWith('admin.maintenance.purge_success', 'success')
  })

  it('清理失败时展示错误反馈', async () => {
    purgeMediaCacheMock.mockRejectedValue(new Error('purge failed'))
    const wrapper = mountComponent()
    await flushPromises()

    const purgeButton = wrapper.findAll('button').find((b) => b.text().includes('admin.maintenance.purge'))
    await purgeButton!.trigger('click')
    await flushPromises()

    expect(showFeedbackMock).toHaveBeenCalledWith('admin.maintenance.purge_failed', 'error')
  })

  it('切换实验特性开关调用 setExperimentalFeature', async () => {
    const wrapper = mountComponent()
    await flushPromises()

    const switches = wrapper.findAllComponents({ name: 'NSwitch' })
    expect(switches.length).toBeGreaterThanOrEqual(2)

    // 切换第一个特性（labs.feature_a: true → false）
    await switches[0].find('input').setValue(false)
    await flushPromises()

    expect(setExperimentalFeatureMock).toHaveBeenCalledWith('labs.feature_a', false)
    expect(showFeedbackMock).toHaveBeenCalledWith('admin.maintenance.feature_updated', 'success')
  })

  it('特性设置失败时展示错误反馈', async () => {
    setExperimentalFeatureMock.mockRejectedValue(new Error('set failed'))
    const wrapper = mountComponent()
    await flushPromises()

    const switches = wrapper.findAllComponents({ name: 'NSwitch' })
    await switches[0].find('input').setValue(false)
    await flushPromises()

    expect(showFeedbackMock).toHaveBeenCalledWith('admin.maintenance.feature_failed', 'error')
  })
})
