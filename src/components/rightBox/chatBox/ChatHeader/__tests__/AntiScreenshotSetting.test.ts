import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AntiScreenshotSetting from '../AntiScreenshotSetting.vue'

// F-2：房间级防截屏开关（可见性由 power_levels 决定 + 切换接线）。
// 无权限时**隐藏**而不是禁用：展示一个必定 403 的开关只会制造困惑。

const { setEnabledMock, enabledRef, canManageRef, showFeedbackMock } = vi.hoisted(() => ({
  setEnabledMock: vi.fn(),
  enabledRef: { current: null as null | { value: boolean } },
  canManageRef: { current: null as null | { value: boolean } },
  showFeedbackMock: vi.fn()
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key })
}))

vi.mock('@/composables/chat/useRoomAntiScreenshot', async () => {
  const { ref } = await import('vue')
  const enabled = ref(false)
  enabledRef.current = enabled
  return {
    useRoomAntiScreenshot: () => ({
      enabled,
      loading: ref(false),
      error: ref(null),
      refresh: vi.fn(),
      setEnabled: setEnabledMock
    })
  }
})

vi.mock('@/services/matrix/room/RoomOperations', async () => {
  const { ref } = await import('vue')
  const canManage = ref(false)
  canManageRef.current = canManage
  return {
    roomOperations: {
      canManageAntiScreenshot: () => canManage.value
    }
  }
})

vi.mock('@/composables/common/useActionFeedback', () => ({
  useActionFeedback: () => ({ showFeedback: showFeedbackMock })
}))

const mountSetting = (roomId: string | null = '!room:example.com') =>
  mount(AntiScreenshotSetting, {
    props: { roomId }
  })

describe('AntiScreenshotSetting（F-2）', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    if (canManageRef.current) canManageRef.current.value = false
  })

  it('无权限（PL 不足）时不渲染开关', () => {
    canManageRef.current!.value = false
    const wrapper = mountSetting()

    expect(wrapper.text()).not.toContain('home.chat_header.anti_screenshot')
  })

  it('有权限时渲染开关与水印说明文案', () => {
    canManageRef.current!.value = true
    const wrapper = mountSetting()

    expect(wrapper.text()).toContain('home.chat_header.anti_screenshot')
    // 文案必须说清「不能阻止截屏」，否则就是虚假承诺
    expect(wrapper.text()).toContain('home.chat_header.anti_screenshot_hint')
  })

  it('roomId 缺失时不渲染（房间级设置没有房间就没有意义）', () => {
    canManageRef.current!.value = true
    const wrapper = mountSetting(null)

    expect(wrapper.text()).not.toContain('home.chat_header.anti_screenshot')
  })

  it('切换调用 setEnabled，失败时提示用户', async () => {
    canManageRef.current!.value = true
    setEnabledMock.mockResolvedValue(false)
    const wrapper = mountSetting()

    await wrapper.find('[role="switch"]').trigger('click')
    await Promise.resolve()

    expect(setEnabledMock).toHaveBeenCalledWith(true)
    expect(showFeedbackMock).toHaveBeenCalled()
  })

  it('切换成功时不弹错误提示', async () => {
    canManageRef.current!.value = true
    setEnabledMock.mockResolvedValue(true)
    const wrapper = mountSetting()

    await wrapper.find('[role="switch"]').trigger('click')
    await Promise.resolve()

    expect(showFeedbackMock).not.toHaveBeenCalled()
  })
})
