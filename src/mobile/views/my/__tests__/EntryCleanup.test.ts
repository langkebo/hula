import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import MyIndex from '../index.vue'
import SimpleBio from '../SimpleBio.vue'

const pushMock = vi.fn()

vi.mock('@/router', () => ({
  default: {
    push: (...args: unknown[]) => pushMock(...args),
    back: vi.fn()
  }
}))

vi.mock('@/utils/Logger', () => ({
  createLogger: () => ({
    debug: vi.fn()
  })
}))

vi.mock('@/stores/domains/user/user', () => ({
  useUserStore: () => ({
    userInfo: {
      avatar: '/avatar.png',
      name: 'Tester',
      resume: 'bio'
    }
  })
}))

vi.mock('@/utils/AvatarUtils', () => ({
  AvatarUtils: {
    getAvatarUrl: (value: string) => value
  }
}))

vi.mock('#/components/my/Settings.vue', () => ({
  default: {
    name: 'Settings',
    template: '<div>settings</div>'
  }
}))

vi.mock('#/components/my/PersonalInfo.vue', () => ({
  default: {
    name: 'PersonalInfo',
    template: '<div>profile</div>',
    props: ['isShow']
  }
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) =>
      ({
        'mobile_my.online': '在线',
        'mobile_my.default_bio': '暂无简介',
        'mobile_my.photos': '相册',
        'mobile_my.files': '文件',
        'mobile_my.appearance': '外观',
        'mobile_my.intelligent': '智能助手'
      })[key] ?? key
  })
}))

describe('Mobile Dynamic entry cleanup', () => {
  it('removes the preview card from `/mobile/my`', () => {
    const wrapper = mount(MyIndex)

    expect(wrapper.text()).not.toContain('查看全部')
    expect(wrapper.text()).not.toContain('动态共享骨架')
  })

  it('keeps my menu free of the legacy dynamic shortcut', () => {
    const wrapper = mount(SimpleBio, {
      global: {
        stubs: {
          AutoFixHeightPage: {
            template: '<div><slot name="container" /></div>',
            props: ['showFooter']
          }
        }
      }
    })

    expect(wrapper.text()).not.toContain('社区')
    expect(wrapper.text()).not.toContain('Community')
    expect(wrapper.text()).not.toContain('收藏')
  })
})
