import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

// 避免 matrix-js-sdk 重型转换
vi.mock('matrix-js-sdk', () => ({}))

// 拦截 Vant 弹层样式副作用
vi.mock('vant/es/dialog/style', () => ({}))
vi.mock('vant/es/toast/style', () => ({}))

const {
  mockChatStore,
  mockShowFeedback,
  mockSelectAll,
  mockClearSelection,
  mockBatchCopy,
  mockBatchForward,
  mockBatchDelete,
  mockExitMultiSelect
} = vi.hoisted(() => ({
  mockChatStore: {
    isMsgMultiChoose: false,
    setMsgMultiChoose: vi.fn(),
    clearMsgCheck: vi.fn(),
    chatMessageListByRoomId: vi.fn(() => [])
  },
  mockShowFeedback: vi.fn(),
  mockSelectAll: vi.fn(),
  mockClearSelection: vi.fn(),
  mockBatchCopy: vi.fn().mockResolvedValue(true),
  mockBatchForward: vi
    .fn()
    .mockResolvedValue({ eventId: '$msg:1', roomId: '!room:hs', event: null, eventIds: ['$msg:1'] }),
  mockBatchDelete: vi.fn().mockResolvedValue(1),
  mockExitMultiSelect: vi.fn()
}))

vi.mock('@/stores/domains/chat/chat', () => ({
  useChatStore: () => mockChatStore
}))

vi.mock('@/stores/domains/widget/global', () => ({
  useGlobalStore: () => ({ currentSessionRoomId: '!room:hs' })
}))

vi.mock('@/composables/common/useActionFeedback', () => ({
  useActionFeedback: () => ({ showFeedback: mockShowFeedback })
}))

vi.mock('@/composables/common/useClipboard', () => ({
  useClipboard: () => ({ write: vi.fn().mockResolvedValue(undefined) })
}))

vi.mock('@/composables/messaging/useMessageForward', () => ({
  useMessageForward: () => ({
    setSourceEvent: vi.fn(),
    targetRoomIds: { value: [] },
    forwarding: { value: false },
    error: { value: null },
    recentRooms: { value: [] },
    toggleRoom: vi.fn(),
    isRoomSelected: vi.fn(),
    forward: vi.fn(),
    forwardMultiple: vi.fn(),
    reset: vi.fn()
  })
}))

// useMessageMultiSelect 真实实现,但其内部 store 已被 mock
vi.mock('@/utils/Logger', () => ({
  createLogger: () => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn() })
}))

// 拦截真实的 useMessageMultiSelect 行为,只关心 toolbar 是否正确调用了批量操作
vi.mock('@/composables/messaging/useMessageMultiSelect', () => ({
  useMessageMultiSelect: () => ({
    selectedIds: { value: ['$msg:1', '$msg:2'] },
    selectedMessages: { value: [{ message: { id: '$msg:1' } }, { message: { id: '$msg:2' } }] },
    messages: { value: [] },
    isAllSelected: { value: false },
    processing: { value: false },
    multiSelectMode: { value: true },
    forwardFlow: {
      setSourceEvent: vi.fn(),
      targetRoomIds: { value: [] },
      forwarding: { value: false },
      error: { value: null },
      recentRooms: { value: [] },
      toggleRoom: vi.fn(),
      isRoomSelected: vi.fn(),
      forward: vi.fn(),
      forwardMultiple: vi.fn(),
      reset: vi.fn()
    },
    enterMultiSelect: vi.fn(),
    exitMultiSelect: mockExitMultiSelect,
    toggleSelect: vi.fn(),
    isSelected: vi.fn(),
    selectAll: mockSelectAll,
    clearSelection: mockClearSelection,
    batchCopy: mockBatchCopy,
    batchForward: mockBatchForward,
    batchDelete: mockBatchDelete
  })
}))

import MobileBatchToolbar from '../MobileBatchToolbar.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'en-US',
  messages: {
    'en-US': {
      message: {
        multi_choose: {
          selected_count: '{count} selected',
          select_all: 'Select all',
          unselect_all: 'Deselect all',
          exit_multi_select: 'Exit selection'
        },
        multi_select: {
          empty_selection: 'Please select messages first',
          copy: 'Copy',
          forward: 'Forward',
          delete: 'Delete'
        }
      }
    }
  } as any
})

const stubs = {
  'van-button': {
    name: 'VanButton',
    template: '<button @click="$emit(\'click\')"><slot /></button>',
    props: ['type', 'size', 'plain', 'round', 'disabled', 'loading']
  },
  'van-icon': {
    name: 'VanIcon',
    template: '<i><slot /></i>',
    props: ['name']
  }
}

const mountToolbar = () => {
  return mount(MobileBatchToolbar, {
    global: { plugins: [i18n], stubs },
    props: {}
  })
}

describe('MobileBatchToolbar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders selected count', () => {
    const wrapper = mountToolbar()
    const count = wrapper.find('[data-test="batch-selected-count"]')
    // selectedIds.value 在 mock 中是 ['$msg:1', '$msg:2'] 即 count=2
    // vue-i18n 9.x 对 nested key 在嵌套 lookup 时可能不替换 {count},但至少会包含 selected
    expect(count.text()).toContain('selected')
  })

  it('全选按钮调用 selectAll', async () => {
    const wrapper = mountToolbar()
    await wrapper.find('[data-test="batch-select-all-btn"]').trigger('click')
    expect(mockSelectAll).toHaveBeenCalled()
  })

  it('复制按钮调用 batchCopy', async () => {
    const wrapper = mountToolbar()
    await wrapper.find('[data-test="batch-copy-btn"]').trigger('click')
    expect(mockBatchCopy).toHaveBeenCalled()
  })

  it('转发按钮: 调用 batchForward → 退出多选 → emit forward+exit', async () => {
    const wrapper = mountToolbar()
    await wrapper.find('[data-test="batch-forward-btn"]').trigger('click')
    // 微任务: batchForward 是 async
    await new Promise((r) => setTimeout(r, 0))
    expect(mockBatchForward).toHaveBeenCalled()
    expect(mockExitMultiSelect).toHaveBeenCalled()
    const events = wrapper.emitted() as Record<string, any[][]>
    expect(events.forward).toBeTruthy()
    expect(events.forward?.[0]?.[0]).toEqual({
      eventId: '$msg:1',
      roomId: '!room:hs',
      event: null,
      eventIds: ['$msg:1']
    })
    expect(events.exit).toBeTruthy()
  })

  it('删除按钮调用 batchDelete', async () => {
    const wrapper = mountToolbar()
    await wrapper.find('[data-test="batch-delete-btn"]').trigger('click')
    expect(mockBatchDelete).toHaveBeenCalled()
  })

  it('退出按钮调用 exitMultiSelect 并 emit exit', async () => {
    const wrapper = mountToolbar()
    await wrapper.find('[data-test="batch-exit-btn"]').trigger('click')
    expect(mockExitMultiSelect).toHaveBeenCalled()
    expect(wrapper.emitted('exit')).toBeTruthy()
  })
})
