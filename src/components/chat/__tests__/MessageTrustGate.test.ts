import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useSettingStore } from '@/stores/domains/settings/setting'
import MessageTrustGate from '../MessageTrustGate.vue'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key })
}))

const mountGate = (trustLevel: 'verified' | 'unverified' | 'risk' | 'plain') =>
  mount(MessageTrustGate, {
    props: { trustLevel },
    slots: { default: '<p data-test="payload">消息正文</p>' }
  })

const setStrict = (strict: boolean) => {
  const store = useSettingStore()
  store.chat.trustGateStrict = strict
}

describe('MessageTrustGate（F-1）', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('默认（非严格）下不产生任何额外 DOM，直接渲染内容', () => {
    const wrapper = mountGate('unverified')

    expect(wrapper.find('[data-test="trust-gate"]').exists()).toBe(false)
    expect(wrapper.find('[data-test="payload"]').exists()).toBe(true)
  })

  it('严格模式下 unverified 消息被模糊并给出展开按钮', () => {
    setStrict(true)
    const wrapper = mountGate('unverified')

    expect(wrapper.find('[data-test="trust-gate"]').exists()).toBe(true)
    expect(wrapper.find('[data-test="trust-gate-reveal"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('chat.encryption.trust_gate_reveal')
    // 内容仍在 DOM 里（是视觉降级，不是访问控制）
    expect(wrapper.find('[data-test="payload"]').exists()).toBe(true)
  })

  it('严格模式下 verified 消息不受影响', () => {
    setStrict(true)
    const wrapper = mountGate('verified')

    expect(wrapper.find('[data-test="trust-gate"]').exists()).toBe(false)
  })

  it('严格模式下 risk 消息额外显示「加密房里是明文」警示', () => {
    setStrict(true)
    const wrapper = mountGate('risk')

    expect(wrapper.text()).toContain('chat.encryption.trust_gate_plaintext_in_encrypted_room')
  })

  it('点击展开后恢复正常渲染，且按钮消失', async () => {
    setStrict(true)
    const wrapper = mountGate('unverified')

    await wrapper.find('[data-test="trust-gate-reveal"]').trigger('click')

    expect(wrapper.find('[data-test="trust-gate"]').exists()).toBe(false)
    expect(wrapper.find('[data-test="payload"]').exists()).toBe(true)
  })

  // 虚拟列表会复用组件实例：上一条展开不能把下一条也带成展开态
  it('trustLevel 变化（实例复用）时重新收起', async () => {
    setStrict(true)
    const wrapper = mountGate('unverified')
    await wrapper.find('[data-test="trust-gate-reveal"]').trigger('click')
    expect(wrapper.find('[data-test="trust-gate"]').exists()).toBe(false)

    await wrapper.setProps({ trustLevel: 'risk' })

    expect(wrapper.find('[data-test="trust-gate"]').exists()).toBe(true)
  })

  it('plain（未加密房间的明文）在严格模式下也不模糊', () => {
    setStrict(true)
    const wrapper = mountGate('plain')

    expect(wrapper.find('[data-test="trust-gate"]').exists()).toBe(false)
  })
})
