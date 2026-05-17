import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import VoiceRecorder from '../VoiceRecorder.vue'

const { showFeedbackMock, loggerDebugMock, loggerErrorMock } = vi.hoisted(() => ({
  showFeedbackMock: vi.fn(),
  loggerDebugMock: vi.fn(),
  loggerErrorMock: vi.fn()
}))

let capturedOptions: {
  onStart: () => void
  onStop: (blob: Blob, duration: number, localPath: string) => void
  onError: () => void
} | null = null

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key
  })
}))

vi.mock('@/composables/common/useActionFeedback', () => ({
  useActionFeedback: () => ({
    showFeedback: showFeedbackMock
  })
}))

vi.mock('@/hooks/useVoiceRecordRust', () => ({
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

  it('uses action feedback when voice recorder reports error', async () => {
    mount(VoiceRecorder)

    expect(capturedOptions).not.toBeNull()
    capturedOptions?.onError()

    expect(showFeedbackMock).toHaveBeenCalledWith('message.voice_recorder.error', 'error')
  })
})
