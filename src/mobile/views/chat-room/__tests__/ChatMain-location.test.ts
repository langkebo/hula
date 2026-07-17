import { createTestingPinia } from '@pinia/testing'
import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

// Mock Vant CSS side-effect imports
vi.mock('vant/es/dialog/style', () => ({}))
vi.mock('vant/es/popup/style', () => ({}))
vi.mock('vant/es/popover/style', () => ({}))

vi.mock('#/views/chat-room/LocationShare.vue', () => ({
  default: {
    name: 'LocationShare',
    template: '<div class="mock-location-share"></div>',
    props: ['show', 'roomId'],
    emits: ['update:show']
  }
}))

const i18n = createI18n({
  legacy: false,
  locale: 'en-US',
  messages: {
    'en-US': {
      mobile_chat: { import_model: 'Import' },
      message_container: {
        long_press: {
          menu_title: '',
          reply: '',
          copy: '',
          forward: '',
          react: '',
          pin: '',
          delete: '',
          multi_select: ''
        },
        reaction: { add_failed: '' }
      },
      common: { cancel: '' }
    }
  } as any
})

describe('MobileChatMain - location sharing', () => {
  it('renders with LocationShare component', async () => {
    const MobileChatMain = (await import('#/views/chat-room/MobileChatMain.vue')).default
    const wrapper = mount(MobileChatMain, {
      global: {
        plugins: [i18n, createTestingPinia({ createSpy: vi.fn })],
        stubs: {
          AutoFixHeightPage: true,
          HeaderBar: true,
          FooterBar: true,
          ChatMain: true,
          MobileMessageActions: true,
          MobileReactionPicker: true,
          MobileBatchToolbar: true,
          LocationShare: true,
          'van-popover': true,
          'van-button': true,
          'van-dialog': true,
          'van-loading': true,
          'van-icon': true,
          'van-action-sheet': true,
          'van-popup': true
        }
      }
    })
    expect(wrapper.html()).toBeTruthy()
  })
})
