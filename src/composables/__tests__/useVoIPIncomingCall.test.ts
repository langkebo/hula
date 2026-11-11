import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent } from 'vue'
import { CallTypeEnum, MittEnum } from '@/enums'
import type { CallInfo } from '@/services/matrix/media/MatrixVoIPService'
import { useVoIPIncomingCall } from '../useVoIPIncomingCall'

const { setIncomingCallCallbackMock, createRtcCallWindowMock, emitMock, isDesktopMock, isNonMatrixWindowMock } =
  vi.hoisted(() => ({
    setIncomingCallCallbackMock: vi.fn(),
    createRtcCallWindowMock: vi.fn().mockResolvedValue(undefined),
    emitMock: vi.fn(),
    isDesktopMock: vi.fn(() => false),
    isNonMatrixWindowMock: vi.fn(() => false)
  }))

vi.mock('@/services/matrix/media/MatrixVoIPService', () => ({
  matrixVoIPService: { setIncomingCallCallback: setIncomingCallCallbackMock }
}))

vi.mock('@/composables/common/useMitt', () => ({
  useMitt: { emit: emitMock }
}))

vi.mock('@/utils/PlatformConstants', () => ({
  isDesktop: isDesktopMock
}))

vi.mock('@/utils/windowLabels', () => ({
  isNonMatrixWindow: isNonMatrixWindowMock
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

const Harness = defineComponent({
  setup() {
    useVoIPIncomingCall({ createRtcCallWindow: createRtcCallWindowMock })
    return () => null
  }
})

const mountAndGetHandler = async () => {
  mount(Harness)
  await flushPromises()
  return setIncomingCallCallbackMock.mock.calls[0]?.[0] as (info: CallInfo) => Promise<void>
}

describe('useVoIPIncomingCall', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    isDesktopMock.mockReturnValue(false)
    isNonMatrixWindowMock.mockReturnValue(false)
  })

  afterEach(() => {
    isDesktopMock.mockReturnValue(false)
  })

  it('移动端把完整 CallInfo 派发给浮层', async () => {
    const handler = await mountAndGetHandler()
    await handler(callInfo)
    await flushPromises()

    expect(emitMock).toHaveBeenCalledWith(MittEnum.MOBILE_VOIP_INCOMING_CALL, callInfo)
    expect(createRtcCallWindowMock).not.toHaveBeenCalled()
  })

  it('桌面端仍创建来电窗口且不派发移动端事件', async () => {
    isDesktopMock.mockReturnValue(true)
    const handler = await mountAndGetHandler()
    await handler(callInfo)
    await flushPromises()

    expect(createRtcCallWindowMock).toHaveBeenCalledWith(
      true,
      '@alice:example.com',
      '!room:example.com',
      CallTypeEnum.VIDEO
    )
    expect(emitMock).not.toHaveBeenCalled()
  })

  it('参与者缺失时跳过，不派发也不建窗', async () => {
    const handler = await mountAndGetHandler()
    await handler({ ...callInfo, participants: [] })
    await flushPromises()

    expect(emitMock).not.toHaveBeenCalled()
    expect(createRtcCallWindowMock).not.toHaveBeenCalled()
  })

  it('非 Matrix 窗口不注册来电回调', async () => {
    isNonMatrixWindowMock.mockReturnValue(true)
    mount(Harness)
    await flushPromises()

    expect(setIncomingCallCallbackMock).not.toHaveBeenCalled()
  })
})
