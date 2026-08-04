import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import ExternalServiceManager from '../ExternalServiceManager.vue'

type ExternalService = {
  id: string
  name: string
  type: 'translation' | 'push_gateway' | 'auth' | 'storage'
  status: 'active' | 'inactive' | 'connecting'
  configSummary?: string
}

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'external_service.title': '外部服务集成',
        'external_service.add': '添加服务',
        'external_service.empty': '暂无已集成的外部服务',
        'external_service.test_connection': '测试连接',
        'external_service.remove': '删除',
        'external_service.type_translation': '翻译服务',
        'external_service.type_push_gateway': '推送网关',
        'external_service.type_auth': '身份验证',
        'external_service.type_storage': '存储后端',
        'external_service.status_active': '活跃',
        'external_service.status_inactive': '离线',
        'external_service.status_connecting': '连接中'
      }
      return translations[key] ?? key
    }
  })
}))

vi.mock('naive-ui', async () => {
  const { defineComponent, h } = await import('vue')

  const passthrough = (name: string) =>
    defineComponent({
      name,
      setup(_props, { slots }) {
        return () => h('div', { 'data-test': name }, slots.default?.())
      }
    })

  return {
    NButton: defineComponent({
      name: 'NButton',
      props: ['type', 'size', 'quaternary', 'ghost', 'loading', 'disabled'],
      emits: ['click'],
      setup(props, { slots, emit }) {
        return () =>
          h(
            'button',
            {
              type: 'button',
              'data-test': 'n-button',
              'data-type': props.type,
              'data-size': props.size,
              disabled: props.disabled,
              onClick: () => emit('click')
            },
            slots.default?.()
          )
      }
    }),
    NEmpty: defineComponent({
      name: 'NEmpty',
      props: ['description'],
      setup(props) {
        return () => h('div', { 'data-test': 'n-empty' }, props.description ?? '')
      }
    }),
    NList: passthrough('NList'),
    NListItem: passthrough('NListItem'),
    NSpin: defineComponent({
      name: 'NSpin',
      props: ['show'],
      setup(props, { slots }) {
        return () => h('div', { 'data-test': 'n-spin', 'data-show': String(!!props.show) }, slots.default?.())
      }
    }),
    NTag: defineComponent({
      name: 'NTag',
      props: ['type', 'size', 'round'],
      setup(_props, { slots }) {
        return () => h('span', { 'data-test': 'n-tag' }, slots.default?.())
      }
    })
  }
})

const sampleServices: ExternalService[] = [
  {
    id: 'srv-translation',
    name: 'OpenAI 翻译',
    type: 'translation',
    status: 'active',
    configSummary: 'api.openai.com/v1'
  },
  {
    id: 'srv-push',
    name: 'FCM 推送',
    type: 'push_gateway',
    status: 'inactive'
  },
  {
    id: 'srv-auth',
    name: 'OIDC 提供方',
    type: 'auth',
    status: 'connecting'
  },
  {
    id: 'srv-storage',
    name: 'S3 兼容存储',
    type: 'storage',
    status: 'active'
  }
]

const mountComponent = (props: Partial<InstanceType<typeof ExternalServiceManager>['$props']> = {}) =>
  mount(ExternalServiceManager, {
    props: {
      services: sampleServices,
      loading: false,
      ...props
    } as any
  })

describe('ExternalServiceManager', () => {
  it('渲染已集成服务列表（名称 + 类型 + 状态）', () => {
    const wrapper = mountComponent()

    const translationRow = wrapper.find('[data-service-id="srv-translation"]')
    expect(translationRow.exists()).toBe(true)
    expect(translationRow.text()).toContain('OpenAI 翻译')
    expect(translationRow.text()).toContain('翻译服务')
    expect(translationRow.text()).toContain('活跃')
  })

  it('loading=true 时显示加载状态', () => {
    const wrapper = mountComponent({ loading: true })

    const spin = wrapper.find('[data-test="n-spin"]')
    expect(spin.exists()).toBe(true)
    expect(spin.attributes('data-show')).toBe('true')
  })

  it('空列表时显示空状态', () => {
    const wrapper = mountComponent({ services: [] })

    const empty = wrapper.find('[data-test="n-empty"]')
    expect(empty.exists()).toBe(true)
    expect(empty.text()).toContain('暂无已集成的外部服务')
  })

  it('点击删除按钮触发 remove 事件', async () => {
    const wrapper = mountComponent()

    const removeButtons = wrapper.findAll('[data-test="n-button"]').filter((btn) => btn.text().includes('删除'))
    expect(removeButtons.length).toBeGreaterThan(0)
    await removeButtons[0]?.trigger('click')

    expect(wrapper.emitted('remove')).toBeTruthy()
    expect(wrapper.emitted('remove')?.[0]).toEqual(['srv-translation'])
  })

  it('点击测试连接按钮触发 test-connection 事件', async () => {
    const wrapper = mountComponent()

    const testButtons = wrapper.findAll('[data-test="n-button"]').filter((btn) => btn.text().includes('测试连接'))
    expect(testButtons.length).toBeGreaterThan(0)
    await testButtons[0]?.trigger('click')

    expect(wrapper.emitted('test-connection')).toBeTruthy()
    expect(wrapper.emitted('test-connection')?.[0]).toEqual(['srv-translation'])
  })

  it('服务状态使用三色标识（online=活跃/offline=离线/busy=连接中）', () => {
    const wrapper = mountComponent()

    const activeDot = wrapper.find('[data-service-id="srv-translation"] .status-dot')
    expect(activeDot.attributes('style')).toContain('--tjg-status-online')

    const inactiveDot = wrapper.find('[data-service-id="srv-push"] .status-dot')
    expect(inactiveDot.attributes('style')).toContain('--tjg-status-offline')

    const connectingDot = wrapper.find('[data-service-id="srv-auth"] .status-dot')
    expect(connectingDot.attributes('style')).toContain('--tjg-status-busy')
  })

  it('组件有 role=region 可访问性属性', () => {
    const wrapper = mountComponent()

    const region = wrapper.find('[role="region"]')
    expect(region.exists()).toBe(true)
    expect(region.attributes('aria-label')).toBeTruthy()
  })

  it('服务类型显示正确（翻译/推送网关/身份验证/存储后端）', () => {
    const wrapper = mountComponent()

    expect(wrapper.find('[data-service-id="srv-translation"]').text()).toContain('翻译服务')
    expect(wrapper.find('[data-service-id="srv-push"]').text()).toContain('推送网关')
    expect(wrapper.find('[data-service-id="srv-auth"]').text()).toContain('身份验证')
    expect(wrapper.find('[data-service-id="srv-storage"]').text()).toContain('存储后端')
  })
})
