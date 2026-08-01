import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AdminExternalServices from '../AdminExternalServices.vue'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key })
}))

vi.mock('@tauri-apps/plugin-log', () => ({
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn()
}))

const listServicesMock = vi.fn()
const getAllHealthMock = vi.fn()
const registerServiceMock = vi.fn()
const updateServiceMock = vi.fn()
const deleteServiceMock = vi.fn()
const checkServiceHealthMock = vi.fn()

vi.mock('@/services/matrix/admin', () => ({
  adminService: {
    externalServices: {
      listServices: (...args: unknown[]) => listServicesMock(...args),
      getAllHealth: (...args: unknown[]) => getAllHealthMock(...args),
      registerService: (...args: unknown[]) => registerServiceMock(...args),
      updateService: (...args: unknown[]) => updateServiceMock(...args),
      deleteService: (...args: unknown[]) => deleteServiceMock(...args),
      checkServiceHealth: (...args: unknown[]) => checkServiceHealthMock(...args)
    }
  }
}))

const showFeedbackMock = vi.fn()
vi.mock('@/composables/common/useActionFeedback', () => ({
  useActionFeedback: () => ({ showFeedback: (...args: unknown[]) => showFeedbackMock(...args) })
}))

// Naive UI 组件注册名不带 N 前缀，stub key 按注册名匹配
const naiveStubs = {
  PageHeader: {
    template: '<div class="n-page-header"><slot name="extra" /><slot /></div>',
    props: ['title', 'subtitle']
  },
  Space: { template: '<div class="n-space"><slot /></div>' },
  Button: {
    template:
      '<button class="n-button" :disabled="disabled" :data-testid="dataTestid" @click="$emit(\'click\')"><slot /></button>',
    props: ['disabled', 'loading', 'type', 'secondary', 'dataTestid', 'size'],
    emits: ['click']
  },
  Card: {
    template: '<div class="n-card"><div class="n-card-title">{{ title }}</div><slot /></div>',
    props: ['title', 'size']
  },
  Empty: { template: '<div class="n-empty">{{ description }}</div>', props: ['description', 'size'] },
  Spin: { template: '<div class="n-spin" />' },
  Tag: { template: '<span class="n-tag"><slot /></span>', props: ['size', 'type'] },
  Select: {
    template:
      '<select class="n-select" v-bind="$attrs" :value="value" @change="$emit(\'update:value\', $event.target.value)"><option v-for="o in options" :key="o.value" :value="o.value">{{ o.label }}</option></select>',
    props: ['value', 'options', 'placeholder', 'disabled'],
    emits: ['update:value']
  },
  Input: {
    template:
      '<input class="n-input" v-bind="$attrs" :value="value" @input="$emit(\'update:value\', $event.target.value)" />',
    props: ['value', 'placeholder', 'type', 'rows'],
    emits: ['update:value']
  },
  Modal: {
    template: '<div class="n-modal" v-if="show"><slot /><slot name="footer" /></div>',
    props: ['show']
  },
  Form: { template: '<form class="n-form"><slot /></form>' },
  FormItem: { template: '<div class="n-form-item"><slot /></div>', props: ['label'] }
}

describe('AdminExternalServices — P1-3 外部服务管理面板', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    listServicesMock.mockResolvedValue([])
    getAllHealthMock.mockResolvedValue([])
  })

  // jsdom 在某些环境下不提供 window.confirm，需要预先定义
  function setupWindowConfirm(returnValue: boolean) {
    const impl = () => returnValue
    if (typeof window.confirm !== 'function') {
      Object.defineProperty(window, 'confirm', { value: impl, writable: true, configurable: true })
    } else {
      window.confirm = impl
    }
  }

  const mountPanel = () =>
    mount(AdminExternalServices, {
      global: { stubs: naiveStubs }
    })

  it('挂载时加载服务列表与健康状态', async () => {
    listServicesMock.mockResolvedValue([
      {
        as_id: 'trendradar_bot',
        service_type: 'trendradar',
        service_id: 'bot',
        display_name: 'Bot',
        is_enabled: true,
        is_healthy: true,
        created_ts: 1700000000000
      }
    ])
    getAllHealthMock.mockResolvedValue([
      {
        service_id: 'trendradar_bot',
        service_type: 'trendradar',
        is_healthy: true,
        last_check_ts: 1700000001000,
        last_success_ts: 1700000001000,
        last_error: null,
        consecutive_failures: 0
      }
    ])

    const wrapper = mountPanel()
    await flushPromises()

    expect(listServicesMock).toHaveBeenCalled()
    expect(getAllHealthMock).toHaveBeenCalled()
    expect(wrapper.find('[data-testid="service-row"]').exists()).toBe(true)
  })

  it('点击刷新按钮重新加载', async () => {
    const wrapper = mountPanel()
    await flushPromises()
    listServicesMock.mockClear()
    getAllHealthMock.mockClear()

    await wrapper.find('[data-testid="refresh-btn"]').trigger('click')
    await flushPromises()
    expect(listServicesMock).toHaveBeenCalled()
    expect(getAllHealthMock).toHaveBeenCalled()
  })

  it('点击健康检查按钮调用 checkServiceHealth', async () => {
    listServicesMock.mockResolvedValue([
      {
        as_id: 'trendradar_bot',
        service_type: 'trendradar',
        service_id: 'bot',
        display_name: 'Bot',
        is_enabled: true,
        is_healthy: true,
        created_ts: 0
      }
    ])
    checkServiceHealthMock.mockResolvedValue({ as_id: 'trendradar_bot', is_healthy: true })

    const wrapper = mountPanel()
    await flushPromises()

    await wrapper.find('[data-testid="action-check-health"]').trigger('click')
    await flushPromises()

    expect(checkServiceHealthMock).toHaveBeenCalledWith('trendradar_bot')
    expect(showFeedbackMock).toHaveBeenCalledWith('external_services.feedback.health_check_success', 'success')
  })

  it('点击切换启用状态调用 updateService', async () => {
    listServicesMock.mockResolvedValue([
      {
        as_id: 'trendradar_bot',
        service_type: 'trendradar',
        service_id: 'bot',
        display_name: 'Bot',
        is_enabled: true,
        is_healthy: true,
        created_ts: 0
      }
    ])
    updateServiceMock.mockResolvedValue({})

    const wrapper = mountPanel()
    await flushPromises()

    await wrapper.find('[data-testid="action-toggle-enabled"]').trigger('click')
    await flushPromises()

    expect(updateServiceMock).toHaveBeenCalledWith('trendradar_bot', { is_enabled: false })
    expect(showFeedbackMock).toHaveBeenCalledWith('external_services.feedback.update_success', 'success')
  })

  it('点击删除按钮在确认后调用 deleteService', async () => {
    listServicesMock.mockResolvedValue([
      {
        as_id: 'trendradar_bot',
        service_type: 'trendradar',
        service_id: 'bot',
        display_name: 'Bot',
        is_enabled: true,
        is_healthy: true,
        created_ts: 0
      }
    ])
    deleteServiceMock.mockResolvedValue(undefined)
    setupWindowConfirm(true)

    const wrapper = mountPanel()
    await flushPromises()

    await wrapper.find('[data-testid="action-delete"]').trigger('click')
    await flushPromises()

    expect(deleteServiceMock).toHaveBeenCalledWith('trendradar_bot')
    expect(showFeedbackMock).toHaveBeenCalledWith('external_services.feedback.delete_success', 'success')
  })

  it('打开注册对话框并提交调用 registerService', async () => {
    registerServiceMock.mockResolvedValue({})

    const wrapper = mountPanel()
    await flushPromises()

    await wrapper.find('[data-testid="register-btn"]').trigger('click')
    await flushPromises()

    expect(wrapper.find('.n-modal').exists()).toBe(true)

    await wrapper.find('[data-testid="register-service-type"]').setValue('trendradar')
    await wrapper.find('[data-testid="register-service-id"]').setValue('news-bot')
    const inputs = wrapper.findAll('.n-input')
    // display_name 是第 3 个 input
    await inputs[2].setValue('News Bot')

    await wrapper.find('[data-testid="register-submit"]').trigger('click')
    await flushPromises()

    expect(registerServiceMock).toHaveBeenCalledWith(
      expect.objectContaining({
        service_type: 'trendradar',
        service_id: 'news-bot',
        display_name: 'News Bot'
      })
    )
    expect(showFeedbackMock).toHaveBeenCalledWith('external_services.feedback.register_success', 'success')
  })

  it('listServices 出错时降级为空列表', async () => {
    listServicesMock.mockRejectedValue(new Error('boom'))
    const wrapper = mountPanel()
    await flushPromises()

    expect(wrapper.find('[data-testid="service-row"]').exists()).toBe(false)
    expect(wrapper.find('.n-empty').exists()).toBe(true)
  })
})
