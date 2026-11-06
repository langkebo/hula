import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

vi.mock('@/stores/domains/widget/global', () => ({
  useGlobalStore: () => ({ currentSession: { detailId: '!room:hs' } })
}))
vi.mock('@/utils/PlatformConstants', () => ({ isIOS: () => false }))
vi.mock('@/utils/TauriInvokeHandler', () => ({ invokeSilently: vi.fn() }))
vi.mock('@/components/rightBox/chatBox/ChatFooter.vue', () => ({
  default: { name: 'ChatFooter', template: '<div />' }
}))

import FooterBar from '../FooterBar.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'en-US',
  messages: {
    'en-US': {
      location_share: { title: 'Location' }
    }
  } as never
})

const mountFooterBar = () =>
  mount(FooterBar, {
    global: {
      plugins: [i18n],
      stubs: {
        'chat-footer': true
      }
    }
  })

describe('FooterBar lifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('does not create a ResizeObserver when mounted', () => {
    const ResizeObserverSpy = vi.fn()
    vi.stubGlobal('ResizeObserver', ResizeObserverSpy)

    const wrapper = mountFooterBar()

    expect(ResizeObserverSpy).not.toHaveBeenCalled()
    expect(wrapper.emitted('updateHeight')).toBeUndefined()
    wrapper.unmount()
  })

  it('no longer declares the removed height reporting dead code', () => {
    const source = readFileSync(resolve(__dirname, '../FooterBar.vue'), 'utf-8')

    expect(source).not.toContain('updateHeight')
    expect(source).not.toContain('ResizeObserver')
    expect(source).not.toContain('defineExpose({ root })')
  })
})

describe('FooterBar voice entry deduplication', () => {
  it('does not mount its own VoicePanel', () => {
    // 移动端语音入口已收敛为 MsgInputMobileControls -> ChatFooter -> MobilePanel
    const source = readFileSync(resolve(__dirname, '../FooterBar.vue'), 'utf-8')

    expect(source).not.toContain('VoicePanel')
    expect(source).not.toContain('showVoicePanel')
  })

  it('keeps the location action', () => {
    const wrapper = mountFooterBar()

    expect(wrapper.find('[data-testid="location-btn"]').exists()).toBe(true)
    wrapper.unmount()
  })
})
