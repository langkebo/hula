import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import VoiceVideoSettings from '../VoiceVideoSettings.vue'

const translationMap: Record<string, string> = {
  'setting.voice_video.audio_section': '音频设置',
  'setting.voice_video.audio_input_label': '音频输入设备',
  'setting.voice_video.audio_input_desc': '选择用于语音通话的麦克风',
  'setting.voice_video.audio_output_label': '音频输出设备',
  'setting.voice_video.audio_output_desc': '选择用于播放声音的扬声器',
  'setting.voice_video.select_microphone': '选择麦克风',
  'setting.voice_video.select_speaker': '选择扬声器',
  'setting.voice_video.input_volume_label': '输入音量',
  'setting.voice_video.input_volume_desc': '调整麦克风音量',
  'setting.voice_video.output_volume_label': '输出音量',
  'setting.voice_video.output_volume_desc': '调整扬声器音量',
  'setting.voice_video.audio_test_label': '音频测试',
  'setting.voice_video.audio_test_desc': '测试麦克风是否正常工作',
  'setting.voice_video.stop_test': '停止测试',
  'setting.voice_video.test_microphone': '测试麦克风',
  'setting.voice_video.audio_level': '音量级别: {value}%',
  'setting.voice_video.video_section': '视频设置',
  'setting.voice_video.video_input_label': '视频输入设备',
  'setting.voice_video.video_input_desc': '选择用于视频通话的摄像头',
  'setting.voice_video.select_camera': '选择摄像头',
  'setting.voice_video.preview_label': '视频预览',
  'setting.voice_video.preview_desc': '预览摄像头画面',
  'setting.voice_video.stop_preview': '停止预览',
  'setting.voice_video.start_preview': '开始预览',
  'setting.voice_video.call_section': '通话设置',
  'setting.voice_video.echo_cancellation_label': '回声消除',
  'setting.voice_video.echo_cancellation_desc': '消除通话中的回声',
  'setting.voice_video.noise_suppression_label': '噪声抑制',
  'setting.voice_video.noise_suppression_desc': '降低背景噪声',
  'setting.voice_video.auto_gain_label': '自动增益',
  'setting.voice_video.auto_gain_desc': '自动调整麦克风音量',
  'setting.voice_video.microphone_fallback': '麦克风 {id}',
  'setting.voice_video.speaker_fallback': '扬声器 {id}',
  'setting.voice_video.camera_fallback': '摄像头 {id}',
  'setting.voice_video.load_devices_failed': '获取设备列表失败，请检查权限',
  'setting.voice_video.microphone_test_started': '麦克风测试已开始',
  'setting.voice_video.microphone_access_failed': '无法访问麦克风，请检查权限',
  'setting.voice_video.preview_started': '视频预览已开始',
  'setting.voice_video.camera_access_failed': '无法访问摄像头，请检查权限'
}

const messageSuccessMock = vi.fn()
const messageErrorMock = vi.fn()
const loggerErrorMock = vi.fn()
const enumerateDevicesMock = vi.fn()
const getUserMediaMock = vi.fn()
const requestAnimationFrameMock = vi.fn(() => 1)
const cancelAnimationFrameMock = vi.fn()
const closeAudioContextMock = vi.fn()

const createFakeStream = () => ({
  getTracks: () => [{ stop: vi.fn() }]
})

class MockAudioContext {
  createMediaStreamSource() {
    return {
      connect: vi.fn()
    }
  }

  createAnalyser() {
    return {
      fftSize: 0,
      frequencyBinCount: 8,
      getByteFrequencyData: vi.fn((data: Uint8Array) => data.fill(64))
    }
  }

  close() {
    closeAudioContextMock()
    return Promise.resolve()
  }
}

vi.mock('naive-ui', () => ({
  NSelect: {
    name: 'NSelect',
    template: '<div class="n-select" />',
    props: ['value', 'options', 'loading', 'placeholder']
  },
  NSlider: { name: 'NSlider', template: '<div class="n-slider" />', props: ['value', 'min', 'max', 'step'] },
  NButton: { name: 'NButton', template: '<button><slot /></button>', props: ['type', 'loading'] },
  NSwitch: { name: 'NSwitch', template: '<div class="n-switch" />', props: ['value'] },
  NDivider: { name: 'NDivider', template: '<hr />' },
  useMessage: () => ({ success: messageSuccessMock, error: messageErrorMock })
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string, params?: Record<string, string>) => {
      if (!params) {
        return translationMap[key] ?? key
      }

      return Object.entries(params).reduce(
        (message, [name, value]) => message.replace(new RegExp(`\\{${name}\\}`, 'g'), value),
        translationMap[key] ?? key
      )
    }
  })
}))

vi.mock('@/utils/Logger', () => ({
  createLogger: vi.fn(() => ({ error: loggerErrorMock }))
}))

describe('VoiceVideoSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()

    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        enumerateDevices: enumerateDevicesMock,
        getUserMedia: getUserMediaMock
      }
    })

    vi.stubGlobal('AudioContext', MockAudioContext)
    vi.stubGlobal('requestAnimationFrame', requestAnimationFrameMock)
    vi.stubGlobal('cancelAnimationFrame', cancelAnimationFrameMock)

    enumerateDevicesMock.mockResolvedValue([
      { kind: 'audioinput', label: 'USB Mic', deviceId: 'audio-input-1' },
      { kind: 'audioinput', label: '', deviceId: 'audio-input-2' },
      { kind: 'audiooutput', label: '', deviceId: 'audio-output-1' },
      { kind: 'videoinput', label: '', deviceId: 'video-input-1' }
    ])
    getUserMediaMock.mockResolvedValue(createFakeStream())
  })

  it('renders translated sections and loads device options', async () => {
    const wrapper = mount(VoiceVideoSettings)
    await flushPromises()

    expect(wrapper.text()).toContain('音频设置')
    expect(wrapper.text()).toContain('视频设置')
    expect(wrapper.text()).toContain('通话设置')
    expect((wrapper.vm as any).audioInputId).toBe('audio-input-1')
    expect((wrapper.vm as any).audioInputOptions[1].label).toBe('麦克风 audio-in')
    expect((wrapper.vm as any).audioOutputOptions[0].label).toBe('扬声器 audio-ou')
    expect((wrapper.vm as any).videoInputOptions[0].label).toBe('摄像头 video-in')
  })

  it('restores saved device and call settings from localStorage', async () => {
    localStorage.setItem('hula-audio-input', 'saved-audio-input')
    localStorage.setItem('hula-audio-output', 'saved-audio-output')
    localStorage.setItem('hula-video-input', 'saved-video-input')
    localStorage.setItem('hula-input-volume', '80')
    localStorage.setItem('hula-output-volume', '60')
    localStorage.setItem('hula-echo-cancellation', 'false')
    localStorage.setItem('hula-noise-suppression', 'false')
    localStorage.setItem('hula-auto-gain', 'false')

    const wrapper = mount(VoiceVideoSettings)
    await flushPromises()

    const vm = wrapper.vm as any
    expect(vm.audioInputId).toBe('saved-audio-input')
    expect(vm.audioOutputId).toBe('saved-audio-output')
    expect(vm.videoInputId).toBe('saved-video-input')
    expect(vm.inputVolume).toBe(80)
    expect(vm.outputVolume).toBe(60)
    expect(vm.echoCancellation).toBe(false)
    expect(vm.noiseSuppression).toBe(false)
    expect(vm.autoGainControl).toBe(false)
  })

  it('starts microphone test successfully', async () => {
    const wrapper = mount(VoiceVideoSettings)
    await flushPromises()

    await (wrapper.vm as any).startAudioTest()

    expect(getUserMediaMock).toHaveBeenCalled()
    expect((wrapper.vm as any).isRecording).toBe(true)
    expect(messageSuccessMock).toHaveBeenCalledWith('麦克风测试已开始')
  })

  it('shows error when camera preview fails', async () => {
    const wrapper = mount(VoiceVideoSettings)
    await flushPromises()
    getUserMediaMock.mockRejectedValueOnce(new Error('permission denied'))

    await (wrapper.vm as any).startPreview()

    expect(messageErrorMock).toHaveBeenCalledWith('无法访问摄像头，请检查权限')
    expect(loggerErrorMock).toHaveBeenCalled()
  })
})
