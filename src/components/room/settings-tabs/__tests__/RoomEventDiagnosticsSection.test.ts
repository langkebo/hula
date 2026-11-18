import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import RoomEventDiagnosticsSection from '../RoomEventDiagnosticsSection.vue'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string, params?: Record<string, unknown>) => (params ? `${key}:${JSON.stringify(params)}` : key)
  })
}))

const mocks = vi.hoisted(() => ({
  getRoomReducedEvents: vi.fn(),
  getRoomRendered: vi.fn(),
  getRoomFragments: vi.fn(),
  getRoomReceipts: vi.fn(),
  getUserId: vi.fn()
}))

vi.mock('@/services/matrix/room/RoomFacade', () => ({
  matrixRoomReadFacade: {
    getRoomReducedEvents: mocks.getRoomReducedEvents,
    getRoomRendered: mocks.getRoomRendered,
    getRoomFragments: mocks.getRoomFragments,
    getRoomReceipts: mocks.getRoomReceipts
  }
}))

vi.mock('@/services/matrix/MatrixClientService', () => ({
  matrixClientService: { getUserId: mocks.getUserId }
}))

const naiveStubs = {
  Spin: { template: '<div class="n-spin" />', props: ['size'] },
  Button: {
    template: '<button :disabled="disabled" @click="$emit(\'click\')"><slot /></button>',
    props: ['size', 'loading', 'disabled'],
    emits: ['click']
  },
  Input: {
    props: ['value', 'placeholder', 'clearable'],
    emits: ['update:value'],
    template: '<input :value="value" @input="$emit(\'update:value\', $event.target.value)" />'
  },
  Select: {
    props: ['value', 'options'],
    emits: ['update:value'],
    template:
      '<select :value="value" @change="$emit(\'update:value\', $event.target.value)"><option v-for="option in options" :key="option.value" :value="option.value">{{ option.label }}</option></select>'
  }
}

const mountSection = async (roomId = '!room:hs') => {
  const wrapper = mount(RoomEventDiagnosticsSection, {
    props: { roomId },
    global: { stubs: naiveStubs }
  })
  await flushPromises()
  return wrapper
}

const reducedOk = {
  status: 'ok',
  snapshot: {
    total: 9,
    events: Array.from({ length: 7 }, (_, index) => ({
      eventId: `$event-${index}:hs`,
      type: 'm.room.message',
      sender: '@a:hs'
    }))
  }
}

const renderedOk = {
  status: 'ok',
  snapshot: {
    rendered: true,
    plainText: 'hello world',
    events: [{ eventId: '$e1', renderedContent: 'hello world' }]
  }
}

const fragmentsOk = {
  status: 'ok',
  snapshot: {
    userId: '@me:hs',
    fragments: [
      { start: '$start-1:hs', end: '$end-1:hs', limited: true },
      { start: '$start-2:hs', end: '$end-2:hs', limited: false }
    ],
    prevBatch: null,
    nextBatch: null
  }
}

const receiptsOk = {
  status: 'ok',
  snapshot: {
    receiptType: 'm.read',
    eventId: '$e1',
    users: [{ userId: '@b:hs', ts: 1700000000000, threadId: null }]
  }
}

function stubDefaults() {
  mocks.getRoomReducedEvents.mockResolvedValue({ status: 'empty' })
  mocks.getRoomRendered.mockResolvedValue({ status: 'empty' })
  mocks.getRoomFragments.mockResolvedValue({ status: 'empty' })
  mocks.getRoomReceipts.mockResolvedValue({ status: 'empty' })
  mocks.getUserId.mockReturnValue('@me:hs')
}

describe('RoomEventDiagnosticsSection — 事件与回执只读诊断', () => {
  beforeEach(() => {
    mocks.getRoomReducedEvents.mockReset()
    mocks.getRoomRendered.mockReset()
    mocks.getRoomFragments.mockReset()
    mocks.getRoomReceipts.mockReset()
    mocks.getUserId.mockReset()
    stubDefaults()
  })

  it('挂载时按 roomId 与当前用户读取三个只读端点', async () => {
    await mountSection()

    expect(mocks.getRoomReducedEvents).toHaveBeenCalledWith('!room:hs')
    expect(mocks.getRoomRendered).toHaveBeenCalledWith('!room:hs')
    expect(mocks.getRoomFragments).toHaveBeenCalledWith('!room:hs', '@me:hs')
    expect(mocks.getRoomReceipts).not.toHaveBeenCalled()
  })

  it('降采样事件展示总数、预览上限与未展示条数', async () => {
    mocks.getRoomReducedEvents.mockResolvedValue(reducedOk)
    const wrapper = await mountSection()

    expect(wrapper.find('[data-testid="event-diag-reduced-summary"]').text()).toContain('"count":7')
    expect(wrapper.find('[data-testid="event-diag-reduced-summary"]').text()).toContain('"total":9')
    expect(wrapper.findAll('[data-testid="event-diag-reduced"] li')).toHaveLength(5)
    expect(wrapper.find('[data-testid="event-diag-reduced"]').text()).toContain('"count":2')
  })

  it('渲染结果展示渲染状态与事件数', async () => {
    mocks.getRoomRendered.mockResolvedValue(renderedOk)
    const wrapper = await mountSection()

    const summary = wrapper.find('[data-testid="event-diag-rendered-summary"]').text()
    expect(summary).toContain('room.settings_drawer.event_diag_rendered_true')
    expect(summary).toContain('"count":1')
    expect(wrapper.find('[data-testid="event-diag-rendered"]').text()).toContain('hello world')
  })

  it('渲染状态缺失时展示未知而不是伪装已渲染', async () => {
    mocks.getRoomRendered.mockResolvedValue({
      status: 'ok',
      snapshot: { rendered: null, plainText: 'x', events: [] }
    })
    const wrapper = await mountSection()

    expect(wrapper.find('[data-testid="event-diag-rendered-summary"]').text()).toContain(
      'room.settings_drawer.event_diag_rendered_unknown'
    )
  })

  it('时间线片段展示数量与缺口标记', async () => {
    mocks.getRoomFragments.mockResolvedValue(fragmentsOk)
    const wrapper = await mountSection()

    expect(wrapper.find('[data-testid="event-diag-fragments-summary"]').text()).toContain('"count":2')
    expect(wrapper.find('[data-testid="event-diag-fragments"]').text()).toContain(
      'room.settings_drawer.event_diag_fragment_limited'
    )
  })

  it('无当前用户时片段区块展示失败，不发起请求', async () => {
    mocks.getUserId.mockReturnValue(null)
    const wrapper = await mountSection()

    expect(mocks.getRoomFragments).not.toHaveBeenCalled()
    expect(wrapper.find('[data-testid="event-diag-fragments-error"]').exists()).toBe(true)
  })

  it('回执区块初始为 idle，未输入事件 ID 时查询按钮禁用', async () => {
    const wrapper = await mountSection()

    expect(wrapper.find('[data-testid="event-diag-receipts"]').text()).toContain(
      'room.settings_drawer.event_diag_receipts_idle'
    )
    expect(wrapper.find('[data-testid="event-diag-receipts-query"]').attributes('disabled')).toBeDefined()
  })

  it('输入事件 ID 后查询回执并渲染用户', async () => {
    mocks.getRoomReceipts.mockResolvedValue(receiptsOk)
    const wrapper = await mountSection()

    await wrapper.find('[data-testid="event-diag-receipts-event-id"]').setValue('$e1')
    await wrapper.find('[data-testid="event-diag-receipts-query"]').trigger('click')
    await flushPromises()

    expect(mocks.getRoomReceipts).toHaveBeenCalledWith('!room:hs', 'm.read', '$e1')
    expect(wrapper.find('[data-testid="event-diag-receipts-summary"]').text()).toContain('"count":1')
    expect(wrapper.find('[data-testid="event-diag-receipts"]').text()).toContain('@b:hs')
  })

  it('回执查询失败时展示失败而不是空态', async () => {
    mocks.getRoomReceipts.mockResolvedValue({ status: 'error' })
    const wrapper = await mountSection()

    await wrapper.find('[data-testid="event-diag-receipts-event-id"]').setValue('$e1')
    await wrapper.find('[data-testid="event-diag-receipts-query"]').trigger('click')
    await flushPromises()

    expect(wrapper.find('[data-testid="event-diag-receipts-error"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="event-diag-receipts"]').text()).not.toContain(
      'room.settings_drawer.event_diag_empty'
    )
  })

  it('端点不支持时三个区块分别展示 unsupported', async () => {
    mocks.getRoomReducedEvents.mockResolvedValue({ status: 'unsupported' })
    mocks.getRoomRendered.mockResolvedValue({ status: 'unsupported' })
    mocks.getRoomFragments.mockResolvedValue({ status: 'unsupported' })
    const wrapper = await mountSection()

    const text = wrapper.text()
    expect(text.match(/room\.settings_drawer\.event_diag_unsupported/g)).toHaveLength(3)
  })

  it('roomId 变化时重新读取并重置回执查询', async () => {
    mocks.getRoomReceipts.mockResolvedValue(receiptsOk)
    const wrapper = await mountSection()

    await wrapper.find('[data-testid="event-diag-receipts-event-id"]').setValue('$e1')
    await wrapper.find('[data-testid="event-diag-receipts-query"]').trigger('click')
    await flushPromises()

    await wrapper.setProps({ roomId: '!other:hs' })
    await flushPromises()

    expect(mocks.getRoomReducedEvents).toHaveBeenLastCalledWith('!other:hs')
    expect(mocks.getRoomRendered).toHaveBeenLastCalledWith('!other:hs')
    expect(mocks.getRoomFragments).toHaveBeenLastCalledWith('!other:hs', '@me:hs')
    expect(wrapper.find('[data-testid="event-diag-receipts"]').text()).toContain(
      'room.settings_drawer.event_diag_receipts_idle'
    )
  })
})
