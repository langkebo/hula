import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import VoiceMessageEnhanced from '../VoiceMessageEnhanced.vue'

const { getVoiceMock } = vi.hoisted(() => ({
  getVoiceMock: vi.fn()
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key
  })
}))

vi.mock('@/composables/common/useActionFeedback', () => ({
  useActionFeedback: () => ({
    showFeedback: vi.fn()
  })
}))

vi.mock('@/services/matrix/media/MatrixVoiceService', () => ({
  matrixVoiceService: {
    getVoice: getVoiceMock
  }
}))

vi.mock('@/stores/domains/user/user', () => ({
  useUserStore: () => ({
    userInfo: {
      uid: '@me:example.com'
    }
  })
}))

class MockAudio {
  src = ''
  playbackRate = 1
  currentTime = 0
  duration = 12
  addEventListener = vi.fn()
  removeEventListener = vi.fn()
  pause = vi.fn()
  play = vi.fn().mockResolvedValue(undefined)
  load = vi.fn()

  constructor(src: string) {
    this.src = src
  }
}

let lastAudioInstance: MockAudio | null = null
const AudioMock = vi.fn(function (this: unknown, src: string) {
  lastAudioInstance = new MockAudio(src)
  return lastAudioInstance
})

describe('VoiceMessageEnhanced', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getVoiceMock.mockResolvedValue({ httpUrl: 'https://example.com/voice.mp3' })
    lastAudioInstance = null
    vi.stubGlobal('Audio', AudioMock)
    vi.spyOn(window, 'getComputedStyle').mockReturnValue({
      getPropertyValue: () => '#000'
    } as unknown as CSSStyleDeclaration)
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      clearRect: vi.fn(),
      beginPath: vi.fn(),
      roundRect: vi.fn(),
      fill: vi.fn(),
      fillStyle: ''
    } as unknown as ReturnType<HTMLCanvasElement['getContext']>)
  })

  it('removes audio listeners on unmount after initializing playback', async () => {
    const wrapper = mount(VoiceMessageEnhanced, {
      props: {
        body: {
          second: 12,
          size: 10,
          url: 'https://example.com/voice.mp3'
        },
        fromUserUid: '@alice:example.com',
        roomId: '!room:example.com',
        messageId: '$event:example.com'
      },
      global: {
        stubs: {
          NSpin: true,
          NPopover: true,
          NButton: true,
          NIcon: true,
          NFlex: true
        }
      }
    })

    await wrapper.find('.voice-main').trigger('click')

    expect(lastAudioInstance?.addEventListener).toHaveBeenCalledTimes(3)

    wrapper.unmount()

    expect(lastAudioInstance?.pause).toHaveBeenCalled()
  })
})
