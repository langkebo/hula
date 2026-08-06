import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

const { mockShowFeedback } = vi.hoisted(() => ({
  mockShowFeedback: vi.fn()
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) =>
      (
        ({
          'login.sso.unavailable_feature': '第三方登录功能暂未开放，请使用账号密码登录',
          'login.third_party.gitee': '使用 Gitee 登录',
          'login.third_party.github': '使用 GitHub 登录'
        }) as Record<string, string>
      )[key] || key
  })
}))

vi.mock('@/composables/common/useActionFeedback', () => ({
  useActionFeedback: () => ({
    showFeedback: mockShowFeedback
  })
}))

vi.mock('@/composables/user/useLoginFlow', () => ({
  useLoginFlow: () => ({
    loading: ref(false),
    loginDisabled: ref(false)
  })
}))

import ThirdPartyLogin from '../ThirdPartyLogin.vue'

describe('ThirdPartyLogin', () => {
  const mountComponent = () =>
    mount(ThirdPartyLogin, {
      props: {
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

  it('renders only Gitee/GitHub entries (enterprise SSO hidden)', () => {
    const wrapper = mountComponent()
    expect(wrapper.find('[aria-label="使用 Gitee 登录"]').exists()).toBe(true)
    expect(wrapper.find('[aria-label="使用 GitHub 登录"]').exists()).toBe(true)
    // 企业 SSO（OIDC/SAML/CAS）入口已下线
    expect(wrapper.find('[aria-label="OIDC 单点登录"]').exists()).toBe(false)
    expect(wrapper.find('[aria-label="SAML 单点登录"]').exists()).toBe(false)
    expect(wrapper.find('[aria-label="CAS 单点登录"]').exists()).toBe(false)
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
