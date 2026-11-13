import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MessageStatusEnum } from '@/enums'
import { createI18nMock } from '~/tests/i18n-messages'

vi.mock('vue-i18n', () => createI18nMock())

const {
  queueOperations,
  getQueueMock,
  removeOperationMock,
  isLocalEventIdMock,
  getRemoteEventIdMock,
  recallMessageMock
} = vi.hoisted(() => ({
  queueOperations: [
    {
      id: 'op-1',
      type: 'message',
      roomId: '!room:server',
      payload: { tempMsgId: 'T1720000000000', payload: {} },
      createdAt: Date.now(),
      retryCount: 0,
      maxRetries: 3,
      status: 'pending'
    }
  ],
  getQueueMock: vi.fn(),
  removeOperationMock: vi.fn(),
  isLocalEventIdMock: vi.fn(),
  getRemoteEventIdMock: vi.fn(),
  recallMessageMock: vi.fn()
}))

vi.mock('@/services/offline/OfflineQueueService', () => ({
  offlineQueueService: {
    getQueue: getQueueMock,
    removeOperation: removeOperationMock
  }
}))

vi.mock('@/services/matrix/messaging/MatrixMessageService', () => ({
  matrixMessageService: {
    isLocalEventId: isLocalEventIdMock,
    getRemoteEventId: getRemoteEventIdMock,
    recallMessage: recallMessageMock
  }
}))

vi.mock('@/services/matrix/room/RoomFacade', () => ({
  matrixRoomActionFacade: {},
  matrixRoomReadFacade: {}
}))

vi.mock('@/composables/chat/openMsgSession', () => ({
  openMsgSession: vi.fn()
}))

vi.mock('@/utils/AttachmentSaver', () => ({
  saveFileAttachmentAs: vi.fn(),
  saveVideoAttachmentAs: vi.fn()
}))

import { deleteLocalMessage, isLocalOrFailedMessage } from '@/composables/chat/contextMenuLists'

describe('本地/失败消息删除', () => {
  beforeEach(() => {
    getQueueMock.mockReturnValue(queueOperations)
    removeOperationMock.mockReset()
    recallMessageMock.mockReset()
    isLocalEventIdMock.mockReset()
    getRemoteEventIdMock.mockReset()
  })

  it('FAILED 消息判定为本地消息', () => {
    isLocalEventIdMock.mockReturnValue(false)
    getRemoteEventIdMock.mockReturnValue(undefined)

    const item = { message: { id: 'T1720000000000', status: MessageStatusEnum.FAILED } } as unknown as Parameters<
      typeof isLocalOrFailedMessage
    >[0]

    expect(isLocalOrFailedMessage(item)).toBe(true)
  })

  it('删除本地/失败消息只做本地移除，清理离线队列且不触发 recallMessage', () => {
    const deleteMsg = vi.fn()
    const item = { message: { id: 'T1720000000000', status: MessageStatusEnum.FAILED } } as unknown as Parameters<
      typeof deleteLocalMessage
    >[0]

    deleteLocalMessage(item, deleteMsg)

    expect(removeOperationMock).toHaveBeenCalledWith('op-1')
    expect(deleteMsg).toHaveBeenCalledWith('T1720000000000')
    expect(recallMessageMock).not.toHaveBeenCalled()
  })

  it('已发送成功的消息不判定为本地消息', () => {
    isLocalEventIdMock.mockReturnValue(false)
    getRemoteEventIdMock.mockReturnValue('$server-event')

    const item = { message: { id: '$server-event', status: MessageStatusEnum.SUCCESS } } as unknown as Parameters<
      typeof isLocalOrFailedMessage
    >[0]

    expect(isLocalOrFailedMessage(item)).toBe(false)
  })
})
