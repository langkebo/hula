import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent } from 'vue'
import type { CallInfo } from '@/services/matrix/media/MatrixVoIPService'
import { useVoIPCallFlow } from '../useVoIPCallFlow'

const { getActiveCallsMock, onCallUpdateMock, answerCallMock, startCallMock, hangupCallMock, handlers } = vi.hoisted(
  () => {
    const handlers: Array<(info: CallInfo) => void> = []
    return {
      handlers,
      getActiveCallsMock: vi.fn(),
      onCallUpdateMock: vi.fn((_callId: string, handler: (info: CallInfo) => void) => {
        handlers.push(handler)
        return () => {}
      }),
      answerCallMock: vi.fn().mockResolvedValue(undefined),
      startCallMock: vi.fn().mockResolvedValue('call-started'),
      hangupCallMock: vi.fn().mockResolvedValue(undefined)
    }
  }
)

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key })
}))

vi.mock('@/composables/common/useActionFeedback', () => ({
  useActionFeedback: () => ({ showFeedback: vi.fn() })
}))

vi.mock('@/utils/Logger', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() })
}))

vi.mock('@/services/matrix/media/MatrixVoIPService', () => ({
  matrixVoIPService: {
    getActiveCalls: getActiveCallsMock,
    onCallUpdate: onCallUpdateMock,
    answerCall: answerCallMock,
    rejectCall: vi.fn(),
    hangupCall: hangupCallMock,
    startCall: startCallMock,
    toggleMute: vi.fn(),
    toggleVideo: vi.fn(),
    startScreenshare: vi.fn(),
    stopScreenshare: vi.fn(),
    checkMediaPermissions: vi.fn(),
    checkVoipAvailability: vi.fn()
  }
}))

const ringingCall: CallInfo = {
  callId: 'call-1',
  roomId: '!room:example.com',
  isVideo: true,
  isGroup: false,
  state: 'ringing',
  participants: [
    { userId: '@alice:example.com', displayName: 'Alice', isMuted: false, isVideoMuted: false, isSpeaking: false }
  ]
}

describe('useVoIPCallFlow 来电初始化', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    handlers.length = 0
    startCallMock.mockReset()
    startCallMock.mockResolvedValue('call-started')
    hangupCallMock.mockReset()
    hangupCallMock.mockResolvedValue(undefined)
    getActiveCallsMock.mockReturnValue([ringingCall])
  })

  it('initialCallId 命中既有通话时立即进入来电态', () => {
    let flow: ReturnType<typeof useVoIPCallFlow> | null = null
    const Harness = defineComponent({
      setup() {
        flow = useVoIPCallFlow({ initialCallId: 'call-1', initialRoomId: '!room:example.com' })
        return () => null
      }
    })
    mount(Harness)

    expect(flow!.isIncoming.value).toBe(true)
    expect(flow!.isVideoEnabled.value).toBe(true)
    expect(flow!.callInfo.value).toEqual(ringingCall)
    expect(onCallUpdateMock).toHaveBeenCalledWith('call-1', expect.any(Function))
  })

  it('订阅后续状态更新', async () => {
    let flow: ReturnType<typeof useVoIPCallFlow> | null = null
    const Harness = defineComponent({
      setup() {
        flow = useVoIPCallFlow({ initialCallId: 'call-1' })
        return () => null
      }
    })
    mount(Harness)

    handlers[0]?.({ ...ringingCall, state: 'connected' })
    await Promise.resolve()

    expect(flow!.isConnected.value).toBe(true)
  })

  it('服务层原地改写同一对象后再次通知时，computed 状态仍会更新', async () => {
    // 复现 MatrixVoIPService 契约：notifyCallUpdate 传回的是被原地修改的同一个对象
    const seeded: CallInfo = { ...ringingCall }
    getActiveCallsMock.mockReturnValue([seeded])

    let flow: ReturnType<typeof useVoIPCallFlow> | null = null
    const Harness = defineComponent({
      setup() {
        flow = useVoIPCallFlow({ initialCallId: 'call-1' })
        return () => null
      }
    })
    mount(Harness)

    // 必须经由 computed 断言：直接读 seeded.state 在修复前后都会通过
    expect(flow!.state.value).toBe('ringing')

    seeded.state = 'connecting'
    handlers[0]?.(seeded)
    await Promise.resolve()

    expect(flow!.state.value).toBe('connecting')
  })

  it('answerCall 无参数时使用 initialCallId', async () => {
    let flow: ReturnType<typeof useVoIPCallFlow> | null = null
    const Harness = defineComponent({
      setup() {
        flow = useVoIPCallFlow({ initialCallId: 'call-1' })
        return () => null
      }
    })
    mount(Harness)

    await flow!.answerCall()

    expect(answerCallMock).toHaveBeenCalledWith('call-1', undefined)
  })
})

describe('useVoIPCallFlow 卸载清理', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    handlers.length = 0
    startCallMock.mockReset()
    startCallMock.mockResolvedValue('call-started')
    hangupCallMock.mockReset()
    hangupCallMock.mockResolvedValue(undefined)
    getActiveCallsMock.mockReturnValue([ringingCall])
  })

  it('startCall 在卸载后才 resolve 时挂断新通话且不写入 callId', async () => {
    let resolveStart: (id: string) => void = () => {}
    startCallMock.mockImplementation(
      () =>
        new Promise<string>((resolve) => {
          resolveStart = resolve
        })
    )

    let flow: ReturnType<typeof useVoIPCallFlow> | null = null
    const Harness = defineComponent({
      setup() {
        flow = useVoIPCallFlow()
        return () => null
      }
    })
    const wrapper = mount(Harness)

    const pending = flow!.startCall('!room:example.com', { audio: true, video: false })
    wrapper.unmount()
    resolveStart('call-new')

    await expect(pending).resolves.toBe(false)
    expect(hangupCallMock).toHaveBeenCalledWith('call-new')
    expect(flow!.callId.value).toBeNull()
    expect(flow!.callInfo.value).toBeNull()
  })

  it('卸载时挂断进行中的通话并清空 callId', async () => {
    let flow: ReturnType<typeof useVoIPCallFlow> | null = null
    const Harness = defineComponent({
      setup() {
        flow = useVoIPCallFlow({ initialCallId: 'call-1' })
        return () => null
      }
    })
    const wrapper = mount(Harness)
    expect(flow!.callId.value).toBe('call-1')

    wrapper.unmount()
    await flushPromises()

    expect(hangupCallMock).toHaveBeenCalledTimes(1)
    expect(hangupCallMock).toHaveBeenCalledWith('call-1')
    expect(flow!.callId.value).toBeNull()
    expect(flow!.callInfo.value).toBeNull()
  })

  it('无进行中通话时卸载不触发挂断', async () => {
    let flow: ReturnType<typeof useVoIPCallFlow> | null = null
    const Harness = defineComponent({
      setup() {
        flow = useVoIPCallFlow()
        return () => null
      }
    })
    const wrapper = mount(Harness)

    wrapper.unmount()
    await flushPromises()

    expect(flow!.callId.value).toBeNull()
    expect(hangupCallMock).not.toHaveBeenCalled()
  })
})
