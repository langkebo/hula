import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import VoiceRecorder from '../VoiceRecorder.vue'

const { loggerDebugMock, loggerErrorMock } = vi.hoisted(() => ({
  loggerDebugMock: vi.fn(),
  loggerErrorMock: vi.fn()
}))

let capturedOptions: {
  onStart: () => void
  onStop: (blob: Blob, duration: number, localPath: string) => void
  onError: (kind: 'permission' | 'unknown', message: string) => void
} | null = null

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key
  })
}))

vi.mock('@/composables/chat/useVoiceRecordRust', () => ({
  useVoiceRecordRust: (options: typeof capturedOptions) => {
    capturedOptions = options
    return {
      isRecording: ref(false),
      recordingTime: ref(0),
      startRecording: vi.fn(),
      stopRecording: vi.fn(),
      cancelRecording: vi.fn(),
      formatTime: (value: number) => `${value}s`
    }
  }
}))

vi.mock('@/utils/Logger', () => ({
  createLogger: () => ({
    debug: loggerDebugMock,
    error: loggerErrorMock
  })
}))

describe('VoiceRecorder', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    capturedOptions = null
  })

  it('emits permissionDenied when microphone permission is denied', () => {
    const wrapper = mount(VoiceRecorder)

    expect(capturedOptions).not.toBeNull()
    capturedOptions?.onError('permission', 'denied')

    expect(wrapper.emitted('permissionDenied')).toHaveLength(1)
  })

  it('does not emit permissionDenied for unknown recording errors', () => {
    const wrapper = mount(VoiceRecorder)

    capturedOptions?.onError('unknown', 'boom')

    expect(wrapper.emitted('permissionDenied')).toBeUndefined()
  })
})
