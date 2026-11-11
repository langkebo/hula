import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MittEnum } from '@/enums'
import type { CallInfo } from '@/services/matrix/media/MatrixVoIPService'
import RtcCallFloatCell from '../RtcCallFloatCell.vue'

const { handlers, pushMock, rejectCallMock, onCallUpdateMock, callUpdateHandlers, getUserInfoMock, currentRoute } =
  vi.hoisted(() => {
    const handlers = new Map<string, (payload?: unknown) => void>()
    const callUpdateHandlers: Array<(info: CallInfo) => void> = []
    return {
      handlers,
      callUpdateHandlers,
      pushMock: vi.fn().mockResolvedValue(undefined),
      rejectCallMock: vi.fn().mockResolvedValue(undefined),
      onCallUpdateMock: vi.fn((_callId: string, handler: (info: CallInfo) => void) => {
        callUpdateHandlers.push(handler)
        return () => {}
      }),
      getUserInfoMock: vi.fn(() => undefined),
      currentRoute: { value: { path: '/mobile/message' } }
    }
  })

vi.mock('@/composables/common/useMitt', () => ({
  useMitt: {
    on: (event: string, handler: (payload?: unknown) => void) => {
      handlers.set(event, handler)
      return () => handlers.delete(event)
    }
  }
}))

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: pushMock, currentRoute })
}))

vi.mock('@/services/matrix/media/MatrixVoIPService', () => ({
  matrixVoIPService: { rejectCall: rejectCallMock, onCallUpdate: onCallUpdateMock }
}))

vi.mock('@/stores/domains/chat/group', () => ({
  useGroupStore: () => ({ getUserInfo: getUserInfoMock })
}))

vi.mock('@/stores/domains/settings/mobile', () => ({
  useMobileStore: () => ({ safeArea: { top: 0, bottom: 0 } })
}))

vi.mock('@/stores/domains/user/user', () => ({
  useUserStore: () => ({ userInfo: { uid: '1' } })
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key })
}))

vi.mock('@/utils/Logger', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() })
}))

const callInfo: CallInfo = {
  callId: 'call-1',
  roomId: '!room:example.com',
  isVideo: true,
  isGroup: false,
  state: 'ringing',
  participants: [
    { userId: '@alice:example.com', displayName: 'Alice', isMuted: false, isVideoMuted: false, isSpeaking: false }
  ]
}

const emitIncoming = async (info: CallInfo = callInfo) => {
  handlers.get(MittEnum.MOBILE_VOIP_INCOMING_CALL)?.(info)
  await flushPromises()
}

describe('RtcCallFloatCell', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    handlers.clear()
    callUpdateHandlers.length = 0
    getUserInfoMock.mockReturnValue(undefined)
    currentRoute.value = { path: '/mobile/message' }
    pushMock.mockResolvedValue(undefined)
  })

  it('收到 Matrix 来电后显示来电人与通话类型', async () => {
    const wrapper = mount(RtcCallFloatCell)
    await emitIncoming()

    expect(wrapper.text()).toContain('Alice')
    expect(wrapper.text()).toContain('mobile_voice_video.video_call_invitation')
  })

  it('接听把 callId 透传到路由 query', async () => {
    const wrapper = mount(RtcCallFloatCell)
    await emitIncoming()

    await wrapper.find('.rtc-action-button.accept').trigger('click')
    await flushPromises()

    expect(pushMock).toHaveBeenCalledWith({
      path: '/mobile/rtcCall',
      query: {
        callId: 'call-1',
        remoteUserId: '@alice:example.com',
        roomId: '!room:example.com',
        callType: '2',
        isIncoming: 'true'
      }
    })
  })

  it('拒接调用 MatrixVoIPService.rejectCall 并收起浮层', async () => {
    const wrapper = mount(RtcCallFloatCell)
    await emitIncoming()

    await wrapper.find('.rtc-action-button.reject').trigger('click')
    await flushPromises()

    expect(rejectCallMock).toHaveBeenCalledWith('call-1')
    expect(wrapper.find('.rtc-call-card').exists()).toBe(false)
  })

  it('通话结束后自动收起浮层', async () => {
    const wrapper = mount(RtcCallFloatCell)
    await emitIncoming()

    callUpdateHandlers[0]?.({ ...callInfo, state: 'ended' })
    await flushPromises()

    expect(wrapper.find('.rtc-call-card').exists()).toBe(false)
  })

  it('信息不完整时忽略', async () => {
    const wrapper = mount(RtcCallFloatCell)
    await emitIncoming({ ...callInfo, participants: [] })

    expect(wrapper.find('.rtc-call-card').exists()).toBe(false)
  })

  it('已在通话页时收到第二路来电按忙线拒绝且不展示浮层', async () => {
    currentRoute.value = { path: '/mobile/rtcCall' }
    const wrapper = mount(RtcCallFloatCell)

    await emitIncoming()

    expect(rejectCallMock).toHaveBeenCalledWith('call-1')
    expect(onCallUpdateMock).not.toHaveBeenCalled()
    expect(wrapper.find('.rtc-call-card').exists()).toBe(false)
  })

  it('跳转通话页失败时保留浮层以便重试', async () => {
    pushMock.mockRejectedValueOnce(new Error('navigation failed'))
    const wrapper = mount(RtcCallFloatCell)
    await emitIncoming()
    expect(wrapper.find('.rtc-call-card').exists()).toBe(true)

    await wrapper.find('.rtc-action-button.accept').trigger('click')
    await flushPromises()

    expect(pushMock).toHaveBeenCalledTimes(1)
    expect(wrapper.find('.rtc-call-card').exists()).toBe(true)
  })
})
