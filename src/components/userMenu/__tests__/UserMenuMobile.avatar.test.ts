import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import UserMenuMobile from '../UserMenuMobile.vue'

const { routerPushMock, closeMenuMock, openMenuMock } = vi.hoisted(() => ({
  routerPushMock: vi.fn(),
  closeMenuMock: vi.fn(),
  openMenuMock: vi.fn()
}))

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: routerPushMock })
}))

vi.mock('@iconify/vue', async () => {
  const { defineComponent, h } = await import('vue')
  return { Icon: defineComponent({ name: 'Icon', setup: () => () => h('i') }) }
})

vi.mock('@/stores/domains/settings/setting', () => ({
  useSettingStore: () => ({ themePattern: 'light' })
}))

vi.mock('@/stores/domains/user/user', () => ({
  useUserStore: () => ({ currentUserAvatarUrl: '' })
}))

vi.mock('@/utils/AvatarUtils', () => ({
  AvatarUtils: { getAvatarUrl: () => '' }
}))

vi.mock('@/utils/Logger', () => ({
  createLogger: () => ({ error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() })
}))

vi.mock('../useUserMenu', async () => {
  const { ref } = await import('vue')
  return {
    useUserMenu: () => ({
      isOpen: ref(false),
      menuSections: [],
      handleMenuItemClick: vi.fn(),
      closeMenu: closeMenuMock,
      openMenu: openMenuMock
    })
  }
})

vi.mock('../UserMenuHeader.vue', async () => {
  const { defineComponent, h } = await import('vue')
  return {
    default: defineComponent({
      name: 'UserMenuHeader',
      emits: ['avatar-click', 'theme-toggle'],
      setup(_, { emit }) {
        return () =>
          h('button', {
            class: 'avatar-stub',
            onClick: (event: MouseEvent) => {
              event.stopPropagation()
              emit('avatar-click')
            }
          })
      }
    })
  }
})

const mountComponent = async () => {
  const { defineComponent, h } = await import('vue')
  return mount(UserMenuMobile, {
    global: {
      stubs: {
        'van-popup': defineComponent({
          name: 'VanPopup',
          props: { show: Boolean },
          setup: (_, { slots }) => () => h('div', slots.default?.())
        }),
        'van-image': true,
        'van-cell': true
      }
    }
  })
}

describe('UserMenuMobile 头像点击打开个人资料', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('把 UserMenuHeader 的 avatar-click 接到移动端编辑资料路由并关闭菜单', async () => {
    const wrapper = await mountComponent()

    await wrapper.get('.avatar-stub').trigger('click')

    expect(routerPushMock).toHaveBeenCalledWith('/mobile/mobileMy/editProfile')
    expect(closeMenuMock).toHaveBeenCalled()
  })
})
