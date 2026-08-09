import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import ErrorState from '@/components/common/ErrorState.vue'

describe('ErrorState', () => {
  it('renders title, message and alert role', () => {
    const wrapper = mount(ErrorState, {
      props: { title: '加载失败', message: '网络异常，请稍后重试' }
    })
    expect(wrapper.find('.error-state').attributes('role')).toBe('alert')
    expect(wrapper.find('.error-state__title').text()).toBe('加载失败')
    expect(wrapper.find('.error-state__message').text()).toBe('网络异常，请稍后重试')
  })

  it('renders default generic-error illustration and switches by prop', () => {
    const generic = mount(ErrorState, { props: { title: 't' } })
    expect(generic.find('[data-illustration="generic-error"]').exists()).toBe(true)

    const network = mount(ErrorState, { props: { title: 't', illustration: 'network-error' } })
    expect(network.find('[data-illustration="network-error"]').exists()).toBe(true)

    const server = mount(ErrorState, { props: { title: 't', illustration: 'server-error' } })
    expect(server.find('[data-illustration="server-error"]').exists()).toBe(true)
  })

  it('renders retry button only when retryText provided and emits retry on click', async () => {
    const noBtn = mount(ErrorState, { props: { title: 't' } })
    expect(noBtn.find('[data-testid="error-retry"]').exists()).toBe(false)

    const wrapper = mount(ErrorState, { props: { title: 't', retryText: '重试' } })
    const btn = wrapper.find('[data-testid="error-retry"]')
    expect(btn.exists()).toBe(true)
    expect(btn.text()).toBe('重试')
    await btn.trigger('click')
    expect(wrapper.emitted('retry')).toBeTruthy()
    expect(wrapper.emitted('retry')!.length).toBe(1)
  })

  it('applies compact class when compact prop is true', () => {
    const wrapper = mount(ErrorState, { props: { title: 't', compact: true } })
    expect(wrapper.find('.error-state').classes()).toContain('error-state--compact')
  })

  it('renders actions slot content', () => {
    const wrapper = mount(ErrorState, {
      props: { title: 't' },
      slots: { actions: '<button data-testid="custom-action">返回</button>' }
    })
    expect(wrapper.find('[data-testid="custom-action"]').exists()).toBe(true)
  })
})
