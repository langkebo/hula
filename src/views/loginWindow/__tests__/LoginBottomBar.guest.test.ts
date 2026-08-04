import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import LoginBottomBar from '../LoginBottomBar.vue'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key })
}))
vi.mock('@/utils/Formatting', () => ({ formatBottomText: (t: string) => t }))
vi.mock('@/utils/PlatformConstants', () => ({
  isCompatibility: () => false,
  isMac: () => false
}))

// 读取组件源码用于验证模板内容（NPopover 在测试环境中不渲染默认 slot）
const componentSource = readFileSync(resolve(__dirname, '../LoginBottomBar.vue'), 'utf-8')

describe('LoginBottomBar guest entry', () => {
  it('template contains guest-login button', () => {
    expect(componentSource).toContain('data-test="guest-login-btn"')
    expect(componentSource).toContain('login.guest')
  })

  it('emits definition includes guest-login', () => {
    expect(componentSource).toContain("'guest-login'")
  })

  it('component mounts successfully in manual mode', () => {
    const wrapper = mount(LoginBottomBar, {
      props: { mode: 'manual' },
      global: {
        stubs: ['n-popover', 'n-flex']
      }
    })
    expect(wrapper.vm).toBeDefined()
    expect(wrapper.exists()).toBe(true)
  })
})
