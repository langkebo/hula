import { beforeEach, describe, expect, it, vi } from 'vitest'

const togglePrivateRoom = vi.fn<(item: unknown, options?: unknown) => Promise<boolean>>(async () => true)
const isRoomPrivate = vi.fn(() => false)
const showConfirmDialog = vi.hoisted(() => vi.fn(async () => 'confirm'))
const showLoadingToast = vi.hoisted(() => vi.fn())
const closeToast = vi.hoisted(() => vi.fn())

vi.mock('vant', () => ({ showConfirmDialog, showLoadingToast, closeToast }))
vi.mock('@/composables/secretChat/usePrivateRoomActions', () => ({
  usePrivateRoomActions: () => ({ togglePrivateRoom, isRoomPrivate })
}))
vi.mock('@/composables/chat/useMessage', () => ({
  useMessage: () => ({ handleMsgDelete: vi.fn() })
}))
vi.mock('@/stores/domains/chat/chat', () => ({
  useChatStore: () => ({ getSessionList: vi.fn(async () => ({})), sessionList: [] })
}))
vi.mock('@/stores/domains/chat/contacts', () => ({ useContactStore: () => ({ getContactList: vi.fn() }) }))
vi.mock('@/stores/domains/widget/global', () => ({ useGlobalStore: () => ({ updateGlobalUnreadCount: vi.fn() }) }))
vi.mock('@/services/matrix/auth/MatrixSessionService', () => ({ matrixSessionService: {} }))
vi.mock('@/services/matrix/MatrixClientService', () => ({ matrixClientService: { on: vi.fn(), off: vi.fn() } }))
vi.mock('@/services/matrix/messaging/MatrixReceiptService', () => ({ matrixReceiptService: {} }))
vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }))
vi.mock('@/composables/common/useActionFeedback', () => ({ useActionFeedback: () => ({ showFeedback: vi.fn() }) }))
vi.mock('@/utils/Logger', () => ({
  createLogger: () => ({ error: vi.fn(), warn: vi.fn(), debug: vi.fn() })
}))

import { useMobileMessageActions } from '../useMobileMessageActions'

const item = { roomId: '!room:test', type: 'single', top: false, unreadCount: 0 } as never

describe('useMobileMessageActions · 私密聊天', () => {
  beforeEach(() => {
    togglePrivateRoom.mockClear()
    isRoomPrivate.mockClear()
    showConfirmDialog.mockClear()
    showLoadingToast.mockClear()
    closeToast.mockClear()
  })

  it('handleTogglePrivate 委托给 togglePrivateRoom 并关闭长按菜单', async () => {
    const close = vi.fn()
    const { handleTogglePrivate } = useMobileMessageActions({
      maskHandler: { close },
      currentLongPressItem: { value: null }
    })

    await handleTogglePrivate(item)

    expect(togglePrivateRoom).toHaveBeenCalledWith(item, {
      confirmEnableEncryption: expect.any(Function)
    })
    expect(showLoadingToast).toHaveBeenCalledWith({
      message: 'mobile_home.private_room_processing',
      duration: 0,
      forbidClick: false
    })
    expect(closeToast).toHaveBeenCalledTimes(1)
    expect(close).toHaveBeenCalledTimes(1)
  })

  it('确认框被取消时确认回调返回 false，不设为私密', async () => {
    showConfirmDialog.mockRejectedValueOnce(new Error('cancel'))
    const close = vi.fn()
    const { handleTogglePrivate } = useMobileMessageActions({
      maskHandler: { close },
      currentLongPressItem: { value: null }
    })

    await handleTogglePrivate(item)

    const options = togglePrivateRoom.mock.calls[0][1] as {
      confirmEnableEncryption: () => Promise<boolean>
    }
    await expect(options.confirmEnableEncryption()).resolves.toBe(false)
  })

  it('item 为空时不做任何事', async () => {
    const close = vi.fn()
    const { handleTogglePrivate } = useMobileMessageActions({
      maskHandler: { close },
      currentLongPressItem: { value: null }
    })

    await handleTogglePrivate(null)

    expect(togglePrivateRoom).not.toHaveBeenCalled()
    expect(close).not.toHaveBeenCalled()
  })
})
