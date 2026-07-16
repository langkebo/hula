import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import CallView from '../CallView.vue'

const toggleSpeakerMock = vi.fn()
const isSpeakerOnRef = ref(true)
const mockLocalStream = new MediaStream()
const mockRemoteStream = new MediaStream()
const callInfoRef = ref<{
  callId: string
  roomId: string
  isVideo: boolean
  isGroup: boolean
  state: 'ringing' | 'connecting' | 'connected' | 'ended' | 'error'
  participants: unknown[]
  localStream?: MediaStream
  remoteStream?: MediaStream
}>({
  callId: 'call-1',
  roomId: 'room-1',
  isVideo: false,
  isGroup: false,
  state: 'connected',
  participants: [],
  localStream: mockLocalStream,
  remoteStream: mockRemoteStream
})

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key })
}))

vi.mock('@/composables/webrtc/useVoIPCallFlow', () => ({
  useVoIPCallFlow: () => ({
    callInfo: callInfoRef,
    toggleSpeaker: toggleSpeakerMock,
    isSpeakerOn: isSpeakerOnRef
  })
}))

vi.mock('@/services/matrix/media/MatrixVoIPService', () => ({
  matrixVoIPService: {
    toggleMute: vi.fn().mockResolvedValue(false),
    toggleVideo: vi.fn().mockResolvedValue(false),
    hangupCall: vi.fn().mockResolvedValue(undefined),
    startScreenshare: vi.fn().mockResolvedValue(undefined),
    stopScreenshare: vi.fn().mockResolvedValue(undefined)
  }
}))

vi.mock('@/utils/Logger', () => ({
  createLogger: () => ({
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn()
  })
}))

vi.mock('@/utils/TimerManager', () => ({
  useTimerManager: () => ({
    setInterval: vi.fn(() => 1),
    clearInterval: vi.fn(),
    clearAll: vi.fn()
  })
}))

// Mock naive-ui globally to resolve n-button, n-avatar, etc.
vi.mock('naive-ui', async () => {
  const { defineComponent } = await import('vue')

  return {
    NButton: defineComponent({
      name: 'NButton',
      props: {
        type: { type: String, default: 'default' },
        size: { type: String, default: 'medium' },
        circle: { type: Boolean, default: false }
      },
      emits: ['click'],
      template:
        '<button class="n-button-stub" :data-type="type" :data-size="size" @click="$emit(\'click\')"><slot /></button>'
    }),
    NAvatar: defineComponent({
      name: 'NAvatar',
      props: {
        round: { type: Boolean, default: false },
        size: { type: [Number, String], default: 40 },
        src: { type: String, default: '' },
        fallbackSrc: { type: String, default: '' }
      },
      template: '<div class="n-avatar-stub" />'
    })
  }
})

const mountCallView = (overrides: Record<string, unknown> = {}) =>
  mount(CallView, {
    props: {
      callId: 'call-1',
      isVideo: false,
      callState: 'connected',
      remoteUser: { userId: '@bob:example.com', displayName: 'Bob' },
      ...overrides
    }
  })

describe('CallView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    isSpeakerOnRef.value = true
    callInfoRef.value = {
      callId: 'call-1',
      roomId: 'room-1',
      isVideo: false,
      isGroup: false,
      state: 'connected',
      participants: [],
      localStream: mockLocalStream,
      remoteStream: mockRemoteStream
    }
  })

  describe('rendering', () => {
    it('renders mute, speaker, and hangup buttons for voice calls', () => {
      const wrapper = mountCallView({ isVideo: false })

      const buttons = wrapper.findAll('.n-button-stub')
      expect(buttons.length).toBeGreaterThanOrEqual(3)
    })

    it('renders video controls when isVideo is true', () => {
      const wrapper = mountCallView({ isVideo: true })

      const buttons = wrapper.findAll('.n-button-stub')
      // mute, speaker, video toggle, camera switch, hangup, screenshare = 6
      expect(buttons.length).toBeGreaterThanOrEqual(5)
    })

    it('renders video elements when isVideo is true', () => {
      const wrapper = mountCallView({ isVideo: true })

      const videos = wrapper.findAll('video')
      expect(videos.length).toBe(2)
    })

    it('renders avatar when isVideo is false (voice call)', () => {
      const wrapper = mountCallView({ isVideo: false })

      expect(wrapper.find('.n-avatar-stub').exists()).toBe(true)
    })

    it('displays the remote user name', () => {
      const wrapper = mountCallView()

      expect(wrapper.text()).toContain('Bob')
    })

    it('displays call type label for voice call', () => {
      const wrapper = mountCallView({ isVideo: false })

      expect(wrapper.text()).toContain('call.voice_call')
    })

    it('displays call type label for video call', () => {
      const wrapper = mountCallView({ isVideo: true })

      expect(wrapper.text()).toContain('call.video_call')
    })
  })

  describe('speaker toggle', () => {
    it('calls toggleSpeaker when speaker button is clicked', async () => {
      const wrapper = mountCallView()

      // Speaker button is the second n-button (index 1)
      const buttons = wrapper.findAll('.n-button-stub')
      const speakerButton = buttons[1]
      expect(speakerButton.exists()).toBe(true)

      await speakerButton.trigger('click')
      expect(toggleSpeakerMock).toHaveBeenCalled()
    })
  })

  describe('camera switch', () => {
    it('does not render camera switch button for voice calls', () => {
      const wrapper = mountCallView({ isVideo: false })

      const buttons = wrapper.findAll('.n-button-stub')
      // mute, speaker, hangup = 3
      expect(buttons.length).toBe(3)
    })

    it('renders camera switch button for video calls', () => {
      const wrapper = mountCallView({ isVideo: true })

      // Should have more buttons than voice call
      const buttons = wrapper.findAll('.n-button-stub')
      expect(buttons.length).toBeGreaterThan(3)
    })
  })

  describe('stream binding', () => {
    it('renders video elements when streams are available', async () => {
      const wrapper = mountCallView({ isVideo: true })
      await flushPromises()

      const videos = wrapper.findAll('video')
      expect(videos.length).toBe(2)
    })

    it('handles null stream gracefully', async () => {
      callInfoRef.value = {
        callId: 'call-1',
        roomId: 'room-1',
        isVideo: true,
        isGroup: false,
        state: 'connected',
        participants: []
        // localStream and remoteStream intentionally omitted to test null handling
      }

      const wrapper = mountCallView({ isVideo: true })
      await flushPromises()

      // Component should still render without errors
      const videos = wrapper.findAll('video')
      expect(videos.length).toBe(2)
    })
  })

  describe('cleanup on unmount', () => {
    it('does not throw when unmounted', () => {
      const wrapper = mountCallView({ isVideo: true })

      expect(() => wrapper.unmount()).not.toThrow()
    })
  })

  describe('hangup', () => {
    it('emits hangup event when hangup button is clicked', async () => {
      const wrapper = mountCallView()

      // Hangup is the third button (index 2): mute, speaker, hangup
      const hangupButton = wrapper.findAll('.n-button-stub')[2]
      await hangupButton.trigger('click')
      await flushPromises()

      expect(wrapper.emitted('hangup')).toBeTruthy()
    })
  })
})
