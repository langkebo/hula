import { createTestingPinia } from '@pinia/testing'
import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

// Mock Vant CSS side-effect imports
vi.mock('vant/es/dialog/style', () => ({}))
vi.mock('vant/es/popup/style', () => ({}))
vi.mock('vant/es/popover/style', () => ({}))

// 避免 matrix-js-sdk 重型转换（~6.7s）导致超时
vi.mock('@/services/matrix/MatrixEventService', () => ({
  default: { on: vi.fn(), off: vi.fn(), emit: vi.fn(), convertEventToMessage: vi.fn() }
}))

// 截断所有 matrix-js-sdk 直接导入路径（MobileChatMain 传递依赖）
vi.mock('matrix-js-sdk', () => ({
  Direction: { Forward: 'f', Backward: 'b' },
  EventType: { Message: 'm.room.message' },
  PushRuleKind: {},
  Visibility: {},
  ClientEvent: {},
  RoomEvent: {},
  RoomStateEvent: {}
}))

vi.mock('#/views/chat-room/LocationShare.vue', () => ({
  default: { name: 'LocationShare', template: '<div></div>', props: ['show', 'roomId'], emits: ['update:show'] }
}))
vi.mock('#/views/chat-room/MobileForwardDialog.vue', () => ({
  default: {
    name: 'MobileForwardDialog',
    template: '<div class="mock-forward-dialog"></div>',
    props: ['visible', 'eventId', 'roomId', 'eventIds'],
    emits: ['update:visible']
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
          delete: ''
        },
        reaction: { add_failed: '' }
      },
      common: { cancel: '' },
      message: { forward: { title: 'Forward' } }
    }
  } as any
})

/**
 * 模块级触发动态导入：`await import()` 写在用例体内时，整棵模块图的转换耗时
 * 会被计入该用例的 `testTimeout`（并行负载下 ChatSetting/MobileChatMain 实测
 * 9–36s，远超 15s/30s）→ 随机超时。放到模块级后成本落在文件的 import 阶段，
 * 该阶段不受 `testTimeout` 约束，同时保留「按需加载」的语义。
 */
const MobileChatMainModule = import('#/views/chat-room/MobileChatMain.vue')

describe('MobileChatMain - forward dialog', () => {
  it('renders with MobileForwardDialog component', { timeout: 30000 }, async () => {
    const MobileChatMain = (await MobileChatMainModule).default
    const wrapper = mount(MobileChatMain, {
      global: {
        plugins: [i18n, createTestingPinia({ createSpy: vi.fn })],
        stubs: {
          AutoFixHeightPage: true,
          HeaderBar: true,
          FooterBar: true,
          ChatMain: true,
          MobileReactionPicker: true,
          LocationShare: true,
          MobileForwardDialog: true,
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
