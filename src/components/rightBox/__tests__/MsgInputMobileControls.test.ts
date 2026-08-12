import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { MobilePanelStateEnum } from '@/enums'
import MsgInputMobileControls from '../MsgInputMobileControls.vue'

vi.mock('naive-ui', async () => {
  const { defineComponent, h } = await import('vue')
  return {
    NButton: defineComponent({
      name: 'NButton',
      props: ['type', 'disabled', 'size'],
      emits: ['click'],
      setup(_, { slots, emit }) {
        return () => h('button', { 'data-test': 'NButton', onClick: () => emit('click') }, slots.default?.())
      }
    }),
    NButtonGroup: defineComponent({
      name: 'NButtonGroup',
      props: ['size'],
      setup(_, { slots }) {
        return () => h('div', { 'data-test': 'NButtonGroup' }, slots.default?.())
      }
    })
  }
})

const baseProps = {
  mobilePanelState: MobilePanelStateEnum.NONE,
  hasInput: '',
  disabledSend: false,
  isAIMode: false,
  isAIStreaming: false
}

describe('rightBox/MsgInputMobileControls', () => {
  const mountComponent = (props: Record<string, unknown> = {}) =>
    mount(MsgInputMobileControls, { props: { ...baseProps, ...props } as never })

  it('点击语音图标触发 handleVoiceClick', async () => {
    const wrapper = mountComponent()
    await wrapper.findAll('svg')[0].trigger('click')
    expect(wrapper.emitted('handleVoiceClick')).toBeTruthy()
  })

  it('点击表情图标触发 handleEmojiClick', async () => {
    const wrapper = mountComponent()
    await wrapper.findAll('svg')[1].trigger('click')
    expect(wrapper.emitted('handleEmojiClick')).toBeTruthy()
  })

  it('无输入时显示「更多」图标并触发 handleMoreClick', async () => {
    const wrapper = mountComponent({ hasInput: '' })
    const svgs = wrapper.findAll('svg')
    // 顺序：voice / emoji / more
    await svgs[2].trigger('click')
    expect(wrapper.emitted('handleMoreClick')).toBeTruthy()
  })

  it('有输入时隐藏「更多」、显示发送按钮', () => {
    const wrapper = mountComponent({ hasInput: 'true' })
    expect(wrapper.find('[data-test="NButton"]').exists()).toBe(true)
    // 有输入时只有 2 个 svg（voice + emoji），无 more
    expect(wrapper.findAll('svg')).toHaveLength(2)
  })

  it('点击发送按钮触发 handleMobileSend', async () => {
    const wrapper = mountComponent({ hasInput: 'true' })
    await wrapper.find('[data-test="NButton"]').trigger('click')
    expect(wrapper.emitted('handleMobileSend')).toBeTruthy()
  })

  it('语音面板激活时语音图标高亮', () => {
    const wrapper = mountComponent({ mobilePanelState: MobilePanelStateEnum.VOICE })
    const svg = wrapper.findAll('svg')[0]
    expect(svg.classes()).toContain('text-[--tjg-color-primary-500]')
  })

  it('AI 流式输出时发送按钮文案切换为「停止思考」', () => {
    const wrapper = mountComponent({ isAIMode: true, isAIStreaming: true, hasInput: 'true' })
    expect(wrapper.find('[data-test="NButton"]').text()).toBe('停止思考')
  })

  it('普通模式发送按钮文案来自 i18n key', () => {
    const wrapper = mountComponent({ isAIMode: false, hasInput: 'true' })
    expect(wrapper.find('[data-test="NButton"]').text()).toBe('editor.send')
  })
})
