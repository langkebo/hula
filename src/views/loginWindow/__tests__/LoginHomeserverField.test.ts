import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { createI18nMock } from '~/tests/i18n-messages'
import LoginHomeserverField from '../LoginHomeserverField.vue'

vi.mock('vue-i18n', () => createI18nMock())

const mountField = (homeserverUrl = '') => mount(LoginHomeserverField, { props: { homeserverUrl } })

type FieldWrapper = ReturnType<typeof mountField>

const inputOf = (wrapper: FieldWrapper) => wrapper.find('input#login-homeserver')

describe('LoginHomeserverField', () => {
  it('默认收起高级提示，点击切换后展开并用 aria-describedby 关联', async () => {
    const wrapper = mountField('https://tjg.im')

    expect(wrapper.find('#login-homeserver-hint').exists()).toBe(false)
    expect(inputOf(wrapper).attributes('aria-describedby')).toBeUndefined()

    await wrapper.find('.login-homeserver-toggle').trigger('click')

    expect(wrapper.find('#login-homeserver-hint').exists()).toBe(true)
    expect(wrapper.find('.login-homeserver-toggle').attributes('aria-expanded')).toBe('true')
    expect(inputOf(wrapper).attributes('aria-describedby')).toBe('login-homeserver-hint')
  })

  it('失焦空值时提示必填，并把错误文案纳入 aria-describedby', async () => {
    const wrapper = mountField('')

    await inputOf(wrapper).trigger('blur')

    const error = wrapper.find('#login-homeserver-error')
    expect(error.exists()).toBe(true)
    expect(error.text()).toBe('请输入 Homeserver 地址')
    expect(error.attributes('role')).toBe('alert')
    expect(inputOf(wrapper).attributes('aria-invalid')).toBe('true')
    expect(inputOf(wrapper).attributes('aria-describedby')).toBe('login-homeserver-error')
    expect(wrapper.emitted('update:homeserverUrl')).toBeUndefined()
  })

  it('失焦非法地址时提示格式错误且不改写输入', async () => {
    const wrapper = mountField('not a url')

    await inputOf(wrapper).trigger('blur')

    expect(wrapper.find('#login-homeserver-error').text()).toBe('Homeserver 地址格式无效')
    expect(inputOf(wrapper).attributes('aria-invalid')).toBe('true')
    expect(wrapper.emitted('update:homeserverUrl')).toBeUndefined()
  })

  it('失焦合法域名时补齐协议写回模型', async () => {
    const wrapper = mountField('matrix.example.com')

    await inputOf(wrapper).trigger('blur')

    expect(wrapper.emitted('update:homeserverUrl')?.[0]).toEqual(['http://matrix.example.com'])
    expect(wrapper.find('#login-homeserver-error').exists()).toBe(false)
    expect(inputOf(wrapper).attributes('aria-invalid')).toBe('false')
  })
})
