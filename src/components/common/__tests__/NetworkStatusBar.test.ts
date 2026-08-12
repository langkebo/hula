import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import NetworkStatusBar from '../NetworkStatusBar.vue'

const connState = vi.hoisted(() => ({ connectionState: 'DISCONNECTED', isInitialized: true }))

vi.mock('@/stores/domains/chat/matrix', () => ({
  useMatrixStore: () => ({
    connectionState: connState.connectionState,
    isInitialized: connState.isInitialized
  })
}))

describe('common/NetworkStatusBar', () => {
  beforeEach(() => {
    connState.connectionState = 'DISCONNECTED'
    connState.isInitialized = true
  })

  const mountComponent = () => mount(NetworkStatusBar)

  it('离线时渲染离线横幅', () => {
    connState.connectionState = 'DISCONNECTED'
    connState.isInitialized = true
    const wrapper = mountComponent()
    expect(wrapper.find('.network-status-bar').exists()).toBe(true)
    // 文案来自 i18n key
    expect(wrapper.find('.network-status-bar__text').text()).toBe('connection.offline')
  })

  it('在线时不渲染横幅', () => {
    connState.connectionState = 'CONNECTED'
    const wrapper = mountComponent()
    expect(wrapper.find('.network-status-bar').exists()).toBe(false)
  })

  it('未初始化时即便 DISCONNECTED 也不显示横幅（避免误报断线）', () => {
    connState.connectionState = 'DISCONNECTED'
    connState.isInitialized = false
    const wrapper = mountComponent()
    expect(wrapper.find('.network-status-bar').exists()).toBe(false)
  })

  it('重连中（RECONNECTING）不显示离线横幅（仅 offline 触发）', () => {
    connState.connectionState = 'RECONNECTING'
    const wrapper = mountComponent()
    expect(wrapper.find('.network-status-bar').exists()).toBe(false)
  })
})
