import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import MobileIgnoredUsers from '../MobileIgnoredUsers.vue'

/**
 * 移动端「已忽略用户」管理（方案 4.4.1）。
 *
 * 背景：`SecuritySettings.vue` 的「已忽略用户」入口指向
 * `/mobile/mobileMy/ignoredUsers`，但该路由与视图**都不存在**——
 * 点击无任何反应。本页即为补齐该目标。
 */

const getIgnoredUsersMock = vi.fn()
const setIgnoredUsersMock = vi.fn()

const showToastMock = vi.fn()
const showConfirmDialogMock = vi.fn().mockResolvedValue(undefined)

vi.mock('vant', async () => {
  const { defineComponent } = await import('vue')
  const passthrough = (name: string, tag = 'div') =>
    defineComponent({ name, inheritAttrs: false, template: `<${tag} v-bind="$attrs"><slot /></${tag}>` })
  return {
    showToast: (...args: any[]) => showToastMock(...args),
    showConfirmDialog: (...args: any[]) => showConfirmDialogMock(...args),
    VanCellGroup: passthrough('VanCellGroup'),
    VanCell: passthrough('VanCell'),
    VanButton: passthrough('VanButton', 'button'),
    VanEmpty: passthrough('VanEmpty'),
    VanLoading: passthrough('VanLoading'),
    VanTabs: passthrough('VanTabs'),
    VanTab: passthrough('VanTab')
  }
})

vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }))
vi.mock('vue-router', () => ({ useRouter: () => ({ push: vi.fn(), back: vi.fn(), replace: vi.fn() }) }))
vi.mock('@/router', () => ({ default: { push: vi.fn(), back: vi.fn(), replace: vi.fn() } }))

vi.mock('@/services/matrix', () => ({
  matrixAccountService: {
    getIgnoredUsers: (...a: any[]) => getIgnoredUsersMock(...a),
    setIgnoredUsers: (...a: any[]) => setIgnoredUsersMock(...a)
  }
}))

vi.mock('@/utils/Logger', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() })
}))

vi.mock('@/mobile/components/chat-room/HeaderBar.vue', () => ({
  default: { name: 'HeaderBar', template: '<div />', props: ['border', 'isOfficial', 'hiddenRight', 'roomName'] }
}))

interface Vm {
  loading: boolean
  ignoredUsers: string[]
  loadIgnoredUsers: () => Promise<void>
  handleUnignore: (userId: string) => Promise<void>
}

const mountPage = () => mount(MobileIgnoredUsers)
const vmOf = (w: ReturnType<typeof mount>) => w.vm as unknown as Vm

describe('MobileIgnoredUsers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getIgnoredUsersMock.mockResolvedValue([])
    setIgnoredUsersMock.mockResolvedValue(true)
  })

  it('挂载时加载已忽略用户', async () => {
    getIgnoredUsersMock.mockResolvedValue(['@a:example.com'])
    const wrapper = mountPage()
    await flushPromises()

    expect(getIgnoredUsersMock).toHaveBeenCalled()
    expect(vmOf(wrapper).ignoredUsers).toEqual(['@a:example.com'])
  })

  it('加载失败时提示且 loading 归位', async () => {
    getIgnoredUsersMock.mockRejectedValueOnce(new Error('boom'))
    const wrapper = mountPage()
    await flushPromises()

    expect(vmOf(wrapper).loading).toBe(false)
    expect(showToastMock).toHaveBeenCalled()
  })

  it('取消忽略：确认后调用 setIgnoredUsers 并移除该项', async () => {
    getIgnoredUsersMock.mockResolvedValue(['@a:example.com', '@b:example.com'])
    const wrapper = mountPage()
    await flushPromises()
    const vm = vmOf(wrapper)

    await vm.handleUnignore('@a:example.com')

    expect(showConfirmDialogMock).toHaveBeenCalled()
    expect(setIgnoredUsersMock).toHaveBeenCalledWith(['@b:example.com'])
    expect(vm.ignoredUsers).toEqual(['@b:example.com'])
  })

  it('取消忽略：用户在确认框取消时不调用接口', async () => {
    showConfirmDialogMock.mockRejectedValueOnce('cancel')
    getIgnoredUsersMock.mockResolvedValue(['@a:example.com'])
    const wrapper = mountPage()
    await flushPromises()

    await vmOf(wrapper).handleUnignore('@a:example.com')

    expect(setIgnoredUsersMock).not.toHaveBeenCalled()
  })

  it('取消忽略失败时提示错误且不移除本地项', async () => {
    setIgnoredUsersMock.mockRejectedValueOnce(new Error('nope'))
    getIgnoredUsersMock.mockResolvedValue(['@a:example.com'])
    const wrapper = mountPage()
    await flushPromises()
    const vm = vmOf(wrapper)

    await vm.handleUnignore('@a:example.com')

    expect(vm.ignoredUsers).toEqual(['@a:example.com'])
    expect(showToastMock).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'fail', message: 'mobile_ignored_users.unignore_failed' })
    )
  })
})
