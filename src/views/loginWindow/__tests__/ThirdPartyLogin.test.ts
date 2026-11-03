import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

const { mockShowFeedback, mockCasLogin } = vi.hoisted(() => ({
  mockShowFeedback: vi.fn(),
  mockCasLogin: vi.fn()
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) =>
      (
        ({
          'login.sso.unavailable_feature': '第三方登录功能暂未开放，请使用账号密码登录',
          'login.third_party.gitee': '使用 Gitee 登录',
          'login.third_party.github': '使用 GitHub 登录',
          'login.cas.label': 'CAS 单点登录'
        }) as Record<string, string>
      )[key] || key
  })
}))

vi.mock('@/composables/common/useActionFeedback', () => ({
  useActionFeedback: () => ({
    showFeedback: mockShowFeedback
  })
}))

vi.mock('@/shared/composables/useLoginFlow', () => ({
  useLoginFlow: () => ({
    loading: ref(false),
    loginDisabled: ref(false)
  })
}))

import ThirdPartyLogin from '../ThirdPartyLogin.vue'

describe('ThirdPartyLogin', () => {
  const mountComponent = (props: { casEnabled?: boolean } = {}) =>
    mount(ThirdPartyLogin, {
      props: {
        ...props,
        casLogin: mockCasLogin,
        loginContext: {
          loading: ref(false),
          loginDisabled: ref(false),
          homeserverUrl: ref('example.com'),
          identityServerUrl: ref('')
        }
      },
      global: {
        stubs: {
          NTooltip: {
            template: '<div><slot name="trigger" /><slot /></div>'
          }
        }
      }
    })

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders only Gitee/GitHub entries when CAS is disabled', () => {
    const wrapper = mountComponent()
    expect(wrapper.find('[aria-label="使用 Gitee 登录"]').exists()).toBe(true)
    expect(wrapper.find('[aria-label="使用 GitHub 登录"]').exists()).toBe(true)
    expect(wrapper.find('[aria-label="CAS 单点登录"]').exists()).toBe(false)
  })

  it('renders the CAS entry when casEnabled is true and triggers casLogin on click', async () => {
    const wrapper = mountComponent({ casEnabled: true })
    const casEntry = wrapper.get('[aria-label="CAS 单点登录"]')

    await casEntry.trigger('click')

    expect(mockCasLogin).toHaveBeenCalledTimes(1)
  })

  it('shows unavailable feedback when Gitee login not configured', async () => {
    const wrapper = mountComponent()
    await wrapper.get('[aria-label="使用 Gitee 登录"]').trigger('click')
    expect(mockShowFeedback).toHaveBeenCalledWith('第三方登录功能暂未开放，请使用账号密码登录', 'info')
  })

  it('shows unavailable feedback when GitHub login not configured', async () => {
    const wrapper = mountComponent()
    await wrapper.get('[aria-label="使用 GitHub 登录"]').trigger('click')
    expect(mockShowFeedback).toHaveBeenCalledWith('第三方登录功能暂未开放，请使用账号密码登录', 'info')
  })
})
