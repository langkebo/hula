import { beforeEach, describe, expect, it, vi } from 'vitest'

const togglePrivateRoom = vi.fn(async () => true)
const isRoomPrivate = vi.fn(() => false)

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
  })

  it('handleTogglePrivate 委托给 togglePrivateRoom 并关闭长按菜单', async () => {
    const close = vi.fn()
    const { handleTogglePrivate } = useMobileMessageActions({
      maskHandler: { close },
      currentLongPressItem: { value: null }
    })

    await handleTogglePrivate(item)

    expect(togglePrivateRoom).toHaveBeenCalledWith(item)
    expect(close).toHaveBeenCalledTimes(1)
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
