import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * `EventReceiptsOverlay` 的判据（ROOM-03 `GET /rooms/{roomId}/receipts/{receiptType}/{eventId}`）。
 *
 * 该浮层是「谁读过这条消息」的唯一入口，成败都在 `getRoomReceipts` 返回的四种
 * `status`（ok / empty / unsupported / error）上：把 unsupported 画成 empty 会让用户
 * 以为「没人读过」，把 error 画成 empty 更是假信息。下面逐态锁定。
 */
const { getRoomReceiptsMock, emitMock } = vi.hoisted(() => ({
  getRoomReceiptsMock: vi.fn(),
  emitMock: vi.fn()
}))

vi.mock('@/services/i18n', () => ({
  useTypedI18n: () => ({
    t: (key: string, params?: Record<string, unknown>) => (params ? `${key}:${JSON.stringify(params)}` : key)
  })
}))

vi.mock('@/services/matrix/room/RoomFacade', () => ({
  matrixRoomReadFacade: { getRoomReceipts: getRoomReceiptsMock },
  matrixRoomActionFacade: {}
}))

/** 捕获组件注册的 mitt 监听，测试里手动触发 */
vi.mock('@/composables/common/useMitt', () => ({
  useMitt: {
    on: (_event: string, handler: (payload: unknown) => void) => {
      emitMock(handler)
    }
  }
}))

import EventReceiptsOverlay from '../EventReceiptsOverlay.vue'

const mountOverlay = () => mount(EventReceiptsOverlay, { attachTo: document.body })
const lastHandler = (): ((payload: unknown) => void) => emitMock.mock.calls.at(-1)?.[0]

describe('EventReceiptsOverlay', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    document.body.innerHTML = ''
  })

  it('ok：渲染已读用户与时间', async () => {
    getRoomReceiptsMock.mockResolvedValue({
      status: 'ok',
      snapshot: {
        receiptType: 'm.read',
        eventId: '$e1',
        users: [
          { userId: '@a:hs', ts: 1700000000000, threadId: null },
          { userId: '@b:hs', ts: null, threadId: null }
        ]
      }
    })
    mountOverlay()
    lastHandler()({ roomId: '!r:hs', eventId: '$e1' })
    await flushPromises()

    const rows = document.body.querySelectorAll('[data-testid="event-receipts-row"]')
    expect(rows).toHaveLength(2)
    expect(rows[0]?.textContent).toContain('@a:hs')
    // ts 缺失时给「时间未知」，而不是渲染成空或 1970
    expect(rows[1]?.textContent).toContain('message.event_receipts.ts_unknown')
    expect(getRoomReceiptsMock).toHaveBeenCalledWith('!r:hs', 'm.read', '$e1')
  })

  it('empty：无回执用户时显示空态而不是空列表', async () => {
    getRoomReceiptsMock.mockResolvedValue({
      status: 'ok',
      snapshot: { receiptType: 'm.read', eventId: '$e1', users: [] }
    })
    mountOverlay()
    lastHandler()({ roomId: '!r:hs', eventId: '$e1' })
    await flushPromises()

    expect(document.body.querySelector('[data-testid="event-receipts-empty"]')).not.toBeNull()
    expect(document.body.querySelectorAll('[data-testid="event-receipts-row"]')).toHaveLength(0)
  })

  it('unsupported：与 empty 区分，不谎称「没人读过」', async () => {
    getRoomReceiptsMock.mockResolvedValue({ status: 'unsupported' })
    mountOverlay()
    lastHandler()({ roomId: '!r:hs', eventId: '$e1' })
    await flushPromises()

    expect(document.body.querySelector('[data-testid="event-receipts-unsupported"]')).not.toBeNull()
    expect(document.body.querySelector('[data-testid="event-receipts-empty"]')).toBeNull()
  })

  it('error：显示错误与重试，重试会重新取数', async () => {
    getRoomReceiptsMock.mockResolvedValueOnce({ status: 'error' })
    mountOverlay()
    lastHandler()({ roomId: '!r:hs', eventId: '$e1' })
    await flushPromises()

    const retry = document.body.querySelector<HTMLElement>('[data-testid="event-receipts-retry"]')
    expect(retry).not.toBeNull()

    getRoomReceiptsMock.mockResolvedValueOnce({ status: 'empty' })
    retry?.click()
    await flushPromises()

    expect(getRoomReceiptsMock).toHaveBeenCalledTimes(2)
    expect(document.body.querySelector('[data-testid="event-receipts-empty"]')).not.toBeNull()
  })

  it('缺 roomId/eventId 的载荷直接忽略（不打开、不请求）', async () => {
    mountOverlay()
    lastHandler()({ roomId: '!r:hs' })
    await flushPromises()

    expect(getRoomReceiptsMock).not.toHaveBeenCalled()
    expect(document.body.querySelector('[data-testid="event-receipts-overlay"]')).toBeNull()
  })
})
