import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CallTypeEnum } from '@/enums'
import { useGlobalStore } from '@/stores/domains/widget/global'
import ChatHeaderRoot from '../ChatHeaderRoot.vue'

const { startRtcCallMock } = vi.hoisted(() => ({
  startRtcCallMock: vi.fn().mockResolvedValue(undefined)
}))

vi.mock('@/composables/common/useWindow', () => ({
  useWindow: () => ({
    startRtcCall: startRtcCallMock
  })
}))

describe('ChatHeaderRoot 通话按钮接线 (#5)', () => {
  let pinia: ReturnType<typeof createPinia>

  beforeEach(() => {
    vi.clearAllMocks()
    pinia = createPinia()
    setActivePinia(pinia)
    useGlobalStore(pinia).currentSessionRoomId = '!room:example.com'
  })

  const mountComponent = () =>
    mount(ChatHeaderRoot, {
      global: {
        plugins: [pinia],
        stubs: {
          ChatHeaderInfo: true,
          ChatHeaderToolbar: true,
          ChatHeaderSidebar: true,
          'n-modal': true
        }
      }
    })

  it('语音通话按钮接 startRtcCall(AUDIO)', async () => {
    const wrapper = mountComponent()
    await (wrapper.vm as unknown as { handleStartVoiceCall: () => Promise<void> }).handleStartVoiceCall()

    expect(startRtcCallMock).toHaveBeenCalledTimes(1)
    expect(startRtcCallMock).toHaveBeenCalledWith(CallTypeEnum.AUDIO)
  })

  it('视频通话按钮接 startRtcCall(VIDEO)', async () => {
    const wrapper = mountComponent()
    await (wrapper.vm as unknown as { handleStartVideoCall: () => Promise<void> }).handleStartVideoCall()

    expect(startRtcCallMock).toHaveBeenCalledTimes(1)
    expect(startRtcCallMock).toHaveBeenCalledWith(CallTypeEnum.VIDEO)
  })

  it('屏幕共享按钮复用视频通话窗口 startRtcCall(VIDEO)', async () => {
    const wrapper = mountComponent()
    await (wrapper.vm as unknown as { handleScreenShare: () => Promise<void> }).handleScreenShare()

    expect(startRtcCallMock).toHaveBeenCalledTimes(1)
    expect(startRtcCallMock).toHaveBeenCalledWith(CallTypeEnum.VIDEO)
  })

  it('缺少会话房间时静默返回，不发起通话', async () => {
    useGlobalStore(pinia).currentSessionRoomId = ''

    const wrapper = mountComponent()
    await (wrapper.vm as unknown as { handleStartVideoCall: () => Promise<void> }).handleStartVideoCall()

    expect(startRtcCallMock).not.toHaveBeenCalled()
  })
})
