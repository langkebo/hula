import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { RoomTypeEnum } from '@/enums'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key })
}))

vi.mock('naive-ui', async () => {
  const { defineComponent, h } = await import('vue')

  const NTooltip = defineComponent({
    name: 'NTooltip',
    setup(_, { slots }) {
      return () => h('div', [slots.trigger?.(), slots.default?.()])
    }
  })

  const NButton = defineComponent({
    name: 'NButton',
    inheritAttrs: true,
    setup(_, { slots, attrs }) {
      return () => h('button', attrs, slots.default?.())
    }
  })

  return { NTooltip, NButton }
})

vi.mock('@tauri-apps/plugin-log', () => ({
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn()
}))

vi.mock('@/services/matrix/MatrixClientService', () => ({
  matrixClientService: { getClient: vi.fn(() => null) }
}))

vi.mock('@/services/matrix/user/MatrixAccountService', () => ({
  matrixAccountService: { getCapabilities: vi.fn().mockResolvedValue({}) }
}))

import { registerCapabilityStoreResolver } from '@/services/matrix/MatrixCapabilityService'
import { useCapabilityStore } from '@/stores/domains/chat/capability'
import ChatHeaderToolbar from '../ChatHeaderToolbar.vue'

describe('ChatHeaderToolbar 群聊隐藏通话按钮 (P2-1)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    registerCapabilityStoreResolver(() => useCapabilityStore())
    // 授予 voip / burn-after-read 能力，使入口按服务端支持情况渲染
    useCapabilityStore().setCapabilities({
      capabilities: { 'm.voice': { enabled: true }, 'io.hula.burn_after_read': { enabled: true } }
    })
  })

  it('单聊时渲染语音/视频通话按钮', () => {
    const wrapper = mount(ChatHeaderToolbar, {
      props: { roomType: RoomTypeEnum.SINGLE }
    })

    expect(wrapper.find('[aria-label="chat.header.voice_call"]').exists()).toBe(true)
    expect(wrapper.find('[aria-label="chat.header.video_call"]').exists()).toBe(true)
  })

  it('群聊时隐藏语音/视频通话按钮', () => {
    const wrapper = mount(ChatHeaderToolbar, {
      props: { roomType: RoomTypeEnum.GROUP }
    })

    expect(wrapper.find('[aria-label="chat.header.voice_call"]').exists()).toBe(false)
    expect(wrapper.find('[aria-label="chat.header.video_call"]').exists()).toBe(false)
  })

  it('服务端不支持 voip 时隐藏通话/会议入口', () => {
    const store = useCapabilityStore()
    store.setCapabilities({ capabilities: {} })

    const wrapper = mount(ChatHeaderToolbar, {
      props: { roomType: RoomTypeEnum.SINGLE }
    })

    expect(wrapper.find('[aria-label="chat.header.voice_call"]').exists()).toBe(false)
    expect(wrapper.find('[aria-label="chat.header.video_call"]').exists()).toBe(false)
    expect(wrapper.find('[aria-label="chat.header.start_meeting"]').exists()).toBe(false)
  })

  it('服务端不支持阅后即焚时隐藏私密模式入口', () => {
    const store = useCapabilityStore()
    store.setCapabilities({ capabilities: {} })

    const wrapper = mount(ChatHeaderToolbar, {
      props: { roomType: RoomTypeEnum.SINGLE }
    })

    expect(wrapper.find('[aria-label="chat.header.private_mode_toggle"]').exists()).toBe(false)
  })
})
