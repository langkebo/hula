import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { resolveCallState } from '@/services/matrix/media/voipState'
import RtcCall from '../index.vue'
import { classifyMediaError, resolveMediaErrorText } from '../mediaError'

describe('resolveCallState', () => {
  it('已接通后 SDK 回到 connecting 视为网络重连', () => {
    expect(resolveCallState('connecting', 'connected', 'connected')).toBe('reconnecting')
  })

  it('响铃阶段进入 connecting 仍是普通建连', () => {
    expect(resolveCallState('connecting', 'ringing', 'ringing')).toBe('connecting')
  })

  it('重连过程中重复的 connecting 事件不会退回普通状态', () => {
    expect(resolveCallState('connecting', 'connecting', 'reconnecting')).toBe('reconnecting')
  })

  it('重连成功后回到 connected', () => {
    expect(resolveCallState('connected', 'connecting', 'reconnecting')).toBe('connected')
  })

  it('不关心的 SDK 状态不改变当前状态', () => {
    expect(resolveCallState('wait_local_media', 'ringing', 'ringing')).toBeNull()
  })
})

describe('classifyMediaError', () => {
  const namedError = (name: string): unknown => Object.assign(new Error(name), { name })

  it('权限被拒', () => {
    expect(classifyMediaError(namedError('NotAllowedError'))).toBe('permission_denied')
    expect(classifyMediaError(namedError('PermissionDeniedError'))).toBe('permission_denied')
  })

  it('设备不存在', () => {
    expect(classifyMediaError(namedError('NotFoundError'))).toBe('device_not_found')
  })

  it('设备被占用', () => {
    expect(classifyMediaError(namedError('NotReadableError'))).toBe('device_busy')
  })

  it('其他异常归为 unknown', () => {
    expect(classifyMediaError(namedError('TypeError'))).toBe('unknown')
    expect(classifyMediaError(undefined)).toBe('unknown')
  })
})

describe('resolveMediaErrorText', () => {
  it('麦克风权限被拒给出麦克风引导', () => {
    expect(resolveMediaErrorText('permission_denied', 'mic')).toEqual({
      messageKey: 'voip.errors.mic_permission_denied',
      guideKey: 'voip.errors.mic_permission_guide'
    })
  })

  it('切换相机失败给出相机引导', () => {
    expect(resolveMediaErrorText('permission_denied', 'camera')).toEqual({
      messageKey: 'voip.errors.camera_permission_denied',
      guideKey: 'voip.errors.camera_permission_guide'
    })
  })

  it('视频通话同时涉及麦克风与相机', () => {
    expect(resolveMediaErrorText('permission_denied', 'av')).toEqual({
      messageKey: 'voip.errors.media_permission_denied',
      guideKey: 'voip.errors.media_permission_guide'
    })
  })

  it('未知错误走通用文案', () => {
    expect(resolveMediaErrorText('unknown', 'camera')).toEqual({
      messageKey: 'voip.errors.media_failed'
    })
  })
})

const { showDialogMock, answerCallMock, rejectCallMock, hangupMock, startCallMock, toggleMuteMock, toggleSpeakerMock } =
  vi.hoisted(() => ({
    showDialogMock: vi.fn().mockResolvedValue(undefined),
    answerCallMock: vi.fn().mockResolvedValue(true),
    rejectCallMock: vi.fn().mockResolvedValue(true),
    hangupMock: vi.fn().mockResolvedValue(undefined),
    startCallMock: vi.fn().mockResolvedValue(true),
    toggleMuteMock: vi.fn().mockResolvedValue(true),
    toggleSpeakerMock: vi.fn().mockResolvedValue(undefined)
  }))

const sharedCallInfo = ref<Record<string, unknown> | null>(null)
const sharedState = ref<string | null>(null)
const sharedLastError = ref<unknown>(null)

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key })
}))

vi.mock('vant', () => ({
  showDialog: showDialogMock
}))

vi.mock('@/router', () => ({
  default: { back: vi.fn(), replace: vi.fn() }
}))

vi.mock('@/composables/useVoIPCallFlow', () => ({
  useVoIPCallFlow: () => ({
    callInfo: sharedCallInfo,
    isAudioMuted: ref(false),
    isSpeakerOn: ref(false),
    loading: ref(false),
    state: sharedState,
    lastError: sharedLastError,
    answerCall: answerCallMock,
    rejectCall: rejectCallMock,
    hangup: hangupMock,
    startCall: startCallMock,
    toggleMute: toggleMuteMock,
    toggleSpeaker: toggleSpeakerMock
  })
}))

vi.mock('@/utils/Logger', () => ({
  createLogger: () => ({
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn()
  })
}))

const globalStubs = {
  VanButton: {
    template: '<button @click="$emit(\'click\')" :aria-label="ariaLabel"><slot /></button>',
    emits: ['click'],
    props: { ariaLabel: String }
  },
  VanImage: { template: '<div />' },
  VanIcon: { template: '<i />' },
  VanLoading: { template: '<span class="van-loading-stub" />' }
}

const mountRtcCall = (overrides: Record<string, unknown> = {}) =>
  mount(RtcCall, {
    props: {
      callId: 'call-1',
      roomId: '!room:example.com',
      isVideo: false,
      isIncoming: true,
      remoteUser: { userId: '@bob:example.com', displayName: 'Bob' },
      ...overrides
    },
    global: { stubs: globalStubs }
  })

describe('RtcCall 重连与错误提示', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    showDialogMock.mockResolvedValue(undefined)
    sharedCallInfo.value = null
    sharedState.value = null
    sharedLastError.value = null
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('reconnecting 时展示重连横幅且保持通话 UI', () => {
    sharedState.value = 'reconnecting'
    sharedCallInfo.value = { state: 'reconnecting', localStream: null, remoteStream: null }

    const wrapper = mountRtcCall()

    expect(wrapper.find('.reconnecting-banner').exists()).toBe(true)
    expect(wrapper.text()).toContain('voip.states.reconnecting')
    // 通话中控件不被横幅打断
    expect(wrapper.find('button[aria-label="voip.call.hangup"]').exists()).toBe(true)
  })

  it('connected 时不展示重连横幅', () => {
    sharedState.value = 'connected'
    sharedCallInfo.value = { state: 'connected', localStream: null, remoteStream: null }

    const wrapper = mountRtcCall()

    expect(wrapper.find('.reconnecting-banner').exists()).toBe(false)
  })

  it('通话出错时先提示可读错误再回退', async () => {
    const wrapper = mountRtcCall()
    await flushPromises()
    expect(wrapper.emitted('close')).toBeFalsy()

    sharedState.value = 'error'
    await flushPromises()

    expect(showDialogMock).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'voip.errors.call_failed', confirmButtonText: 'common.close' })
    )
    expect(wrapper.emitted('close')).toHaveLength(1)
  })
})
