import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent } from 'vue'
import VoiceVideoSettings from '../VoiceVideoSettings.vue'

const showToastMock = vi.fn()
const PICKED_DEVICE_ID = 'picked-device'

const { loadPreferencesSpy, savePreferencesSpy } = vi.hoisted(() => ({
  loadPreferencesSpy: vi.fn(),
  savePreferencesSpy: vi.fn()
}))

// 只包裹共享偏好模块的读写入口，落盘仍走真实实现，这样既能断言"经共享模块写回"，
// 又能验证 localStorage 的往返。
vi.mock('@/services/media/mediaDevicePreferences', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/services/media/mediaDevicePreferences')>()
  return {
    ...actual,
    loadMediaDevicePreferences: (...args: Parameters<typeof actual.loadMediaDevicePreferences>) => {
      loadPreferencesSpy(...args)
      return actual.loadMediaDevicePreferences(...args)
    },
    saveMediaDevicePreferences: (...args: Parameters<typeof actual.saveMediaDevicePreferences>) => {
      savePreferencesSpy(...args)
      return actual.saveMediaDevicePreferences(...args)
    }
  }
})

vi.mock('vant', () => ({
  showToast: (...args: unknown[]) => showToastMock(...args)
}))

vi.mock('@iconify/vue', () => ({
  Icon: { name: 'Icon', template: '<i />', props: ['icon', 'width', 'color'] }
}))

vi.mock('@/mobile/components/chat-room/AutoFixHeightPage.vue', () => ({
  default: {
    name: 'AutoFixHeightPage',
    template: '<div><slot name="header" /><slot name="container" /></div>',
    props: ['showFooter']
  }
}))

vi.mock('@/mobile/components/chat-room/HeaderBar.vue', () => ({
  default: {
    name: 'HeaderBar',
    template: '<div />',
    props: ['border', 'isOfficial', 'hiddenRight', 'roomName']
  }
}))

const VanCellStub = defineComponent({
  name: 'VanCell',
  props: ['title', 'label', 'isLink'],
  template: `<div class="van-cell">
    <span class="van-cell__title">{{ title }}</span>
    <slot name="icon" />
    <slot name="value" />
    <slot name="right-icon" />
  </div>`
})

const VanFieldStub = defineComponent({
  name: 'VanField',
  props: { modelValue: { type: String, default: '' } },
  emits: ['click', 'update:modelValue'],
  template: `<div class="device-field" @click="$emit('click')">{{ modelValue }}</div>`
})

const VanPopupStub = defineComponent({
  name: 'VanPopup',
  props: { show: { type: Boolean, default: false } },
  template: '<div v-if="show" class="picker-popup"><slot /></div>'
})

const VanPickerStub = defineComponent({
  name: 'VanPicker',
  emits: ['confirm', 'cancel'],
  template: `<button class="picker-confirm" @click="$emit('confirm', { selectedOptions: [{ value: '${PICKED_DEVICE_ID}' }] })">ok</button>`
})

// 模拟 van-switch 的 v-model + change 语义：真实组件会在用户切换时同时更新 modelValue 并抛出 change。
const VanSwitchStub = defineComponent({
  name: 'VanSwitch',
  props: { modelValue: { type: Boolean, default: false } },
  emits: ['update:modelValue', 'change'],
  template: `<button class="quality-switch" :data-value="String(modelValue)" @click="toggle" />`,
  setup(props, { emit }) {
    const toggle = () => {
      const next = !props.modelValue
      emit('update:modelValue', next)
      emit('change', next)
    }
    return { toggle }
  }
})

function mountComponent() {
  return mount(VoiceVideoSettings, {
    global: {
      stubs: {
        'van-cell-group': { template: '<div><slot /></div>' },
        'van-cell': VanCellStub,
        'van-field': VanFieldStub,
        'van-picker-group': { template: '<div><slot /></div>' },
        'van-slider': { template: '<div class="van-slider" />', props: ['modelValue', 'min', 'max'] },
        'van-switch': VanSwitchStub,
        'van-button': { template: '<button><slot /></button>', props: ['type', 'size', 'loading'] },
        'van-popup': VanPopupStub,
        'van-picker': VanPickerStub
      }
    }
  })
}

const devices = [
  { kind: 'audioinput', deviceId: 'mic-1', label: 'Mic 1' },
  { kind: 'audiooutput', deviceId: 'spk-1', label: 'Speaker 1' },
  { kind: 'videoinput', deviceId: 'cam-1', label: 'Cam 1' }
] as unknown as MediaDeviceInfo[]

async function confirmEveryDevicePicker(wrapper: ReturnType<typeof mountComponent>) {
  for (const field of wrapper.findAll('.device-field')) {
    await field.trigger('click')
  }
  for (const confirm of wrapper.findAll('.picker-confirm')) {
    await confirm.trigger('click')
  }
}

describe('VoiceVideoSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      writable: true,
      value: {
        enumerateDevices: vi.fn().mockResolvedValue(devices),
        getUserMedia: vi.fn()
      }
    })
  })

  it('不再渲染零消费方的输出设备与输入/输出音量控件', async () => {
    const wrapper = mountComponent()
    await flushPromises()

    // 下列 key 已随 2026-09-22 孤儿文案清理删除（Task 7）；桩件对未命中 key 原样返回，
    // 断言其不出现即断言这些控件没有被重新接回。
    expect(wrapper.text()).not.toContain('mobile_voice_video.audio_output')
    expect(wrapper.text()).not.toContain('mobile_voice_video.input_volume')
    expect(wrapper.text()).not.toContain('mobile_voice_video.output_volume')
  })

  it('保留麦克风/摄像头选择与三个音质开关', async () => {
    const wrapper = mountComponent()
    await flushPromises()

    expect(wrapper.text()).toContain('mobile_voice_video.audio_input')
    expect(wrapper.text()).toContain('mobile_voice_video.video_input')
    expect(wrapper.text()).toContain('mobile_voice_video.echo_cancellation')
    expect(wrapper.text()).toContain('mobile_voice_video.noise_suppression')
    expect(wrapper.text()).toContain('mobile_voice_video.auto_gain')
    expect(wrapper.findAll('.quality-switch')).toHaveLength(3)
  })

  it('确认所有设备选择器后不写死 key，仍写在用的设备 key', async () => {
    const wrapper = mountComponent()
    await flushPromises()

    await confirmEveryDevicePicker(wrapper)

    expect(localStorage.getItem('tjg-audio-output')).toBeNull()
    expect(localStorage.getItem('tjg-input-volume')).toBeNull()
    expect(localStorage.getItem('tjg-output-volume')).toBeNull()
    expect(localStorage.getItem('tjg-audio-input')).toBe(PICKED_DEVICE_ID)
    expect(localStorage.getItem('tjg-video-input')).toBe(PICKED_DEVICE_ID)
  })

  it('音质开关经共享偏好模块写回，并在重新挂载时回读', async () => {
    const wrapper = mountComponent()
    await flushPromises()

    // 默认三个开关全开，且挂载时走共享模块读取
    expect(loadPreferencesSpy).toHaveBeenCalled()
    const switches = wrapper.findAll('.quality-switch')
    expect(switches.map((s) => s.attributes('data-value'))).toEqual(['true', 'true', 'true'])

    await switches[0].trigger('click')
    expect(savePreferencesSpy).toHaveBeenCalledWith({ echoCancellation: false })
    expect(localStorage.getItem('tjg-echo-cancellation')).toBe('false')

    await switches[1].trigger('click')
    expect(savePreferencesSpy).toHaveBeenCalledWith({ noiseSuppression: false })
    expect(localStorage.getItem('tjg-noise-suppression')).toBe('false')

    await switches[2].trigger('click')
    expect(savePreferencesSpy).toHaveBeenCalledWith({ autoGain: false })
    expect(localStorage.getItem('tjg-auto-gain')).toBe('false')

    // 重新挂载后从共享模块读回同一份偏好
    wrapper.unmount()
    const remounted = mountComponent()
    await flushPromises()

    expect(remounted.findAll('.quality-switch').map((s) => s.attributes('data-value'))).toEqual([
      'false',
      'false',
      'false'
    ])
  })
})
