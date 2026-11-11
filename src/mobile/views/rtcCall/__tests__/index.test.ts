import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import RtcCall from '../index.vue'

const {
  answerCallMock,
  rejectCallMock,
  hangupMock,
  startCallMock,
  toggleMuteMock,
  toggleVideoMock,
  toggleSpeakerMock
} = vi.hoisted(() => ({
  answerCallMock: vi.fn().mockResolvedValue(true),
  rejectCallMock: vi.fn().mockResolvedValue(true),
  hangupMock: vi.fn().mockResolvedValue(undefined),
  startCallMock: vi.fn().mockResolvedValue(true),
  toggleMuteMock: vi.fn().mockResolvedValue(true),
  toggleVideoMock: vi.fn().mockResolvedValue(true),
  toggleSpeakerMock: vi.fn().mockResolvedValue(undefined)
}))

// Shared refs that can be mutated in tests to simulate call state changes
const sharedCallInfo = ref<any>(null)
const sharedIsSpeakerOn = ref(false)
const sharedState = ref<string | null>(null)

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key })
}))

vi.mock('@/composables/useVoIPCallFlow', () => ({
  useVoIPCallFlow: () => ({
    callInfo: sharedCallInfo,
    isAudioMuted: ref(false),
    isVideoEnabled: ref(false),
    isSpeakerOn: sharedIsSpeakerOn,
    loading: ref(false),
    state: sharedState,
    answerCall: answerCallMock,
    rejectCall: rejectCallMock,
    hangup: hangupMock,
    startCall: startCallMock,
    toggleMute: toggleMuteMock,
    toggleVideo: toggleVideoMock,
    toggleSpeaker: toggleSpeakerMock
  })
}))

vi.mock('@/stores/domains/settings/mobile', () => ({
  useMobileStore: () => ({
    safeArea: { top: 0, bottom: 0 }
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

vi.mock('@/services/matrix/media/MatrixVoIPService', () => ({
  matrixVoIPService: {
    toggleMute: vi.fn().mockResolvedValue(true),
    toggleVideo: vi.fn().mockResolvedValue(true),
    startCall: vi.fn(),
    answerCall: vi.fn(),
    rejectCall: vi.fn(),
    hangupCall: vi.fn(),
    onCallUpdate: vi.fn()
  }
}))

const VanButtonStub = {
  template: '<button @click="$emit(\'click\')" :aria-label="ariaLabel"><slot /></button>',
  emits: ['click'],
  props: { ariaLabel: String }
}

const globalStubs = {
  VanButton: VanButtonStub,
  VanImage: { template: '<div />' },
  VanIcon: { template: '<i />' }
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

describe('RtcCall (mobile)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    answerCallMock.mockResolvedValue(true)
    rejectCallMock.mockResolvedValue(true)
    hangupMock.mockResolvedValue(undefined)
    startCallMock.mockResolvedValue(true)
    sharedCallInfo.value = null
    sharedIsSpeakerOn.value = false
    sharedState.value = null
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('渲染来电界面:显示来电人与接听/拒绝按钮', () => {
    const wrapper = mountRtcCall()

    // 来电界面渲染来电人昵称与通话类型文案
    expect(wrapper.text()).toContain('Bob')
    expect(wrapper.text()).toContain('voip.incoming.voice_call')
    // 接听/拒绝圆形大按钮存在
    expect(wrapper.find('button[aria-label="voip.incoming.decline"]').exists()).toBe(true)
    expect(wrapper.find('button[aria-label="voip.incoming.answer"]').exists()).toBe(true)
    // 不应渲染去电取消按钮
    expect(wrapper.find('button[aria-label="voip.outgoing.cancel"]').exists()).toBe(false)
  })

  it('点击拒绝按钮调用 rejectCall 并 emit reject/close', async () => {
    const wrapper = mountRtcCall()

    await wrapper.find('button[aria-label="voip.incoming.decline"]').trigger('click')
    await flushPromises()

    // 通话 id 由 composable 内部持有，页面不再把 props.callId 透传进去
    expect(rejectCallMock).toHaveBeenCalledWith()
    expect(wrapper.emitted('reject')).toBeTruthy()
    expect(wrapper.emitted('close')).toBeTruthy()
  })

  it('点击接听按钮调用 answerCall', async () => {
    const wrapper = mountRtcCall()

    await wrapper.find('button[aria-label="voip.incoming.answer"]').trigger('click')
    await flushPromises()

    // 接听只传媒体约束，callId 由 composable 从 initialCallId 解析
    expect(answerCallMock).toHaveBeenCalledWith(undefined, { audio: true, video: false })
    expect(wrapper.emitted('answer')).toBeTruthy()
  })

  it('去电场景渲染取消按钮并发起通话', async () => {
    // 去电没有 Matrix callId（路由 mapper 会给空字符串），必须由本页发起
    const wrapper = mountRtcCall({ isIncoming: false, callId: '' })
    await flushPromises()

    expect(wrapper.find('button[aria-label="voip.outgoing.cancel"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('voip.states.ringing_outgoing')
    // 来电按钮不应出现
    expect(wrapper.find('button[aria-label="voip.incoming.answer"]').exists()).toBe(false)
    // 去电必须由本页发起，否则永远停在响铃界面
    expect(startCallMock).toHaveBeenCalledWith('!room:example.com', { audio: true, video: false })
  })

  it('通话中界面渲染扬声器和静音按钮', () => {
    sharedCallInfo.value = { state: 'connected', localStream: null, remoteStream: null }
    const wrapper = mountRtcCall()

    expect(wrapper.find('button[aria-label="voip.call.speaker"]').exists()).toBe(true)
    expect(wrapper.find('button[aria-label="voip.call.mute"]').exists()).toBe(true)
    expect(wrapper.find('button[aria-label="voip.call.hangup"]').exists()).toBe(true)
  })

  it('点击扬声器按钮调用 toggleSpeaker', async () => {
    sharedCallInfo.value = { state: 'connected', localStream: null, remoteStream: null }
    const wrapper = mountRtcCall()

    await wrapper.find('button[aria-label="voip.call.speaker"]').trigger('click')
    await flushPromises()

    expect(toggleSpeakerMock).toHaveBeenCalled()
  })

  it('挂断按钮调用 hangup 并 emit close', async () => {
    sharedCallInfo.value = { state: 'connected', localStream: null, remoteStream: null }
    const wrapper = mountRtcCall()

    await wrapper.find('button[aria-label="voip.call.hangup"]').trigger('click')
    await flushPromises()

    expect(hangupMock).toHaveBeenCalled()
    expect(wrapper.emitted('close')).toBeTruthy()
  })

  it('视频通话中显示摄像头切换按钮', () => {
    sharedCallInfo.value = { state: 'connected', localStream: null, remoteStream: null }
    const wrapper = mountRtcCall({ isVideo: true, isIncoming: true })

    expect(wrapper.find('button[aria-label="voip.call.switch_camera"]').exists()).toBe(true)
  })

  it('语音通话中不显示摄像头切换按钮', () => {
    sharedCallInfo.value = { state: 'connected', localStream: null, remoteStream: null }
    const wrapper = mountRtcCall({ isVideo: false })

    expect(wrapper.find('button[aria-label="voip.call.switch_camera"]').exists()).toBe(false)
  })

  it('卸载时清理视频流绑定', () => {
    sharedCallInfo.value = {
      state: 'connected',
      localStream: new MediaStream(),
      remoteStream: new MediaStream()
    }

    const wrapper = mountRtcCall({ isVideo: true, isIncoming: false })
    expect(wrapper.html()).toBeTruthy()
    wrapper.unmount()
    // 验证组件卸载不会抛出异常
  })

  it('远端结束通话时 emit close 并退出页面', async () => {
    const wrapper = mountRtcCall({ isIncoming: false, callId: '' })
    await flushPromises()
    expect(wrapper.emitted('close')).toBeFalsy()

    sharedState.value = 'ended'
    await flushPromises()

    expect(wrapper.emitted('close')).toBeTruthy()
  })
})
