import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent } from 'vue'
import VoiceVideoSettings from '../VoiceVideoSettings.vue'

const showToastMock = vi.fn()
const PICKED_DEVICE_ID = 'picked-device'

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

function mountComponent() {
  return mount(VoiceVideoSettings, {
    global: {
      stubs: {
        'van-cell-group': { template: '<div><slot /></div>' },
        'van-cell': VanCellStub,
        'van-field': VanFieldStub,
        'van-picker-group': { template: '<div><slot /></div>' },
        'van-slider': { template: '<div class="van-slider" />', props: ['modelValue', 'min', 'max'] },
        'van-switch': { template: '<button class="quality-switch" />', props: ['modelValue'] },
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
})
