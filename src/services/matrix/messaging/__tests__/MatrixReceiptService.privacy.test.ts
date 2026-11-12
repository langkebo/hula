import { beforeEach, describe, expect, it, vi } from 'vitest'
import { registerPrivacyPreferenceHooks } from '@/services/matrix/privacyPreferences'
import { matrixReceiptService } from '../MatrixReceiptService'

const { sendReceiptByEventIdMock, enqueueMock, clientMock } = vi.hoisted(() => {
  const sendReceiptByEventId = vi.fn().mockResolvedValue(undefined)
  const enqueue = vi.fn()
  const roomMock = {
    getLiveTimeline: () => ({ getEvents: () => [{ getId: () => '$e1' }] })
  }
  return {
    sendReceiptByEventIdMock: sendReceiptByEventId,
    enqueueMock: enqueue,
    clientMock: {
      getReadReceiptsManager: () => ({ sendReadReceiptByEventId: sendReceiptByEventId }),
      getRoom: () => roomMock,
      getUserId: () => '@me:x'
    }
  }
})

vi.mock('@/services/offline/OfflineQueueService', () => ({
  offlineQueueService: { enqueue: enqueueMock }
}))

// BaseMatrixService 走具名导出，MatrixReceiptService 自身走默认导出，两边都要桩
vi.mock('@/services/matrix/MatrixClientService', () => ({
  default: { getClient: () => clientMock },
  matrixClientService: { getClient: () => clientMock }
}))

let sendReadReceiptsEnabled = true

describe('MatrixReceiptService 尊重「发送已读回执」偏好', () => {
  beforeEach(() => {
    // 偏好由应用入口注入（S7：service 不再 import store），测试直接注入取值函数
    sendReadReceiptsEnabled = true
    registerPrivacyPreferenceHooks({
      isSendTypingNotificationsEnabled: () => true,
      isShowOnlineStatusEnabled: () => true,
      isSendReadReceiptsEnabled: () => sendReadReceiptsEnabled
    })
    vi.clearAllMocks()
  })

  it('关闭偏好后不发送已读回执（按事件 ID 路径）', async () => {
    sendReadReceiptsEnabled = false
    await matrixReceiptService.sendReadReceiptByEventId('!r:off-by-id', '$e1')
    expect(sendReceiptByEventIdMock).not.toHaveBeenCalled()
  })

  it('偏好开启时正常发送', async () => {
    sendReadReceiptsEnabled = true
    await matrixReceiptService.sendReadReceiptByEventId('!r:on-by-id', '$e1')
    expect(sendReceiptByEventIdMock).toHaveBeenCalledWith('!r:on-by-id', '$e1')
  })

  it('关闭偏好后不发送已读回执（MatrixEvent 路径）', async () => {
    sendReadReceiptsEnabled = false
    // 用服务签名推导事件类型，避免测试直接 import matrix-js-sdk（sdk-boundary 守卫）
    const event = { getId: () => '$e1' } as unknown as Parameters<typeof matrixReceiptService.sendReadReceipt>[1]
    await matrixReceiptService.sendReadReceipt('!r:off-event', event)
    expect(sendReceiptByEventIdMock).not.toHaveBeenCalled()
  })

  it('关闭偏好后标记房间已读也不发送回执，并报告「未发出」', async () => {
    sendReadReceiptsEnabled = false
    const sent = await matrixReceiptService.markRoomAsRead('!r:off-mark')
    expect(sent).toBe(false)
    expect(sendReceiptByEventIdMock).not.toHaveBeenCalled()
  })

  it('偏好开启时标记房间已读会发出回执，并报告「已发出」', async () => {
    sendReadReceiptsEnabled = true
    const sent = await matrixReceiptService.markRoomAsRead('!r:on-mark')
    expect(sent).toBe(true)
    expect(sendReceiptByEventIdMock).toHaveBeenCalledWith('!r:on-mark', '$e1')
  })

  it('关闭偏好后离线也不入队回执，避免联网后补发', async () => {
    sendReadReceiptsEnabled = false
    const onLineSpy = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
    await matrixReceiptService.sendReadReceiptByEventId('!r:off-offline', '$e1')
    expect(enqueueMock).not.toHaveBeenCalled()
    onLineSpy.mockRestore()
  })

  it('偏好开启但离线时仍会入队，证明拦截来自偏好而非离线分支', async () => {
    sendReadReceiptsEnabled = true
    const onLineSpy = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
    await matrixReceiptService.sendReadReceiptByEventId('!r:on-offline', '$e1')
    expect(enqueueMock).toHaveBeenCalledWith('receipt', '!r:on-offline', { roomId: '!r:on-offline', eventId: '$e1' })
    onLineSpy.mockRestore()
  })
})
