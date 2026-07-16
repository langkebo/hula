import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import RtcCall from '../index.vue'

const { answerCallMock, rejectCallMock, hangupMock, toggleMuteMock, toggleVideoMock, toggleSpeakerMock } = vi.hoisted(
  () => ({
    answerCallMock: vi.fn().mockResolvedValue(true),
    rejectCallMock: vi.fn().mockResolvedValue(true),
    hangupMock: vi.fn().mockResolvedValue(undefined),
    toggleMuteMock: vi.fn().mockResolvedValue(true),
    toggleVideoMock: vi.fn().mockResolvedValue(true),
    toggleSpeakerMock: vi.fn().mockResolvedValue(undefined)
  })
)

// Shared refs that can be mutated in tests to simulate call state changes
const sharedCallInfo = ref<any>(null)
const sharedIsSpeakerOn = ref(false)

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key })
}))

vi.mock('@/composables/webrtc/useVoIPCallFlow', () => ({
  useVoIPCallFlow: () => ({
    callInfo: sharedCallInfo,
    isAudioMuted: ref(false),
    isVideoEnabled: ref(false),
    isSpeakerOn: sharedIsSpeakerOn,
    loading: ref(false),
    state: ref(null),
    answerCall: answerCallMock,
    rejectCall: rejectCallMock,
    hangup: hangupMock,
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
    sharedCallInfo.value = null
    sharedIsSpeakerOn.value = false
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

    expect(rejectCallMock).toHaveBeenCalledWith('call-1')
    expect(wrapper.emitted('reject')).toBeTruthy()
    expect(wrapper.emitted('close')).toBeTruthy()
  })

  it('点击接听按钮调用 answerCall', async () => {
    const wrapper = mountRtcCall()

    await wrapper.find('button[aria-label="voip.incoming.answer"]').trigger('click')
    await flushPromises()

    expect(answerCallMock).toHaveBeenCalledWith('call-1', { audio: true, video: false })
    expect(wrapper.emitted('answer')).toBeTruthy()
  })

  it('去电场景渲染取消按钮', () => {
    const wrapper = mountRtcCall({ isIncoming: false })

    expect(wrapper.find('button[aria-label="voip.outgoing.cancel"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('voip.states.ringing_outgoing')
    // 来电按钮不应出现
    expect(wrapper.find('button[aria-label="voip.incoming.answer"]').exists()).toBe(false)
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
})
