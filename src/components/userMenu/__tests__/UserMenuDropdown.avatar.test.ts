import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import UserMenuDropdown from '../UserMenuDropdown.vue'

const { openSettingsMock } = vi.hoisted(() => ({ openSettingsMock: vi.fn() }))

vi.mock('@iconify/vue', async () => {
  const { defineComponent, h } = await import('vue')
  return { Icon: defineComponent({ name: 'Icon', setup: () => () => h('i') }) }
})

vi.mock('../useUserMenu', () => ({
  useUserMenu: () => ({
    menuSections: [],
    openSettings: openSettingsMock
  })
}))

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
            onClick: () => emit('avatar-click')
          })
      }
    })
  }
})

const mountComponent = () =>
  mount(UserMenuDropdown, {
    props: { position: { x: 10, y: 10 } },
    global: { stubs: { teleport: true } }
  })

describe('UserMenuDropdown 头像点击打开个人资料', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('把 UserMenuHeader 的 avatar-click 接到账号设置（个人资料）路由', async () => {
    const wrapper = mountComponent()

    await wrapper.get('.avatar-stub').trigger('click')

    expect(openSettingsMock).toHaveBeenCalledWith('account')
  })
})
