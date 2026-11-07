import { describe, expect, it, vi } from 'vitest'
import { MsgEnum, RoomTypeEnum } from '@/enums'
import type { MessageType } from '@/types/message'
import { useReplaceMsg } from '../useReplaceMsg'

const currentUid = '@me:server'

vi.mock('@/stores/domains/user/user', () => ({
  useUserStore: () => ({ userInfo: { uid: currentUid } })
}))

vi.mock('@/stores/domains/chat/chat', () => ({
  useChatStore: () => ({ getSession: vi.fn(() => undefined) })
}))

vi.mock('@/stores/domains/chat/group', () => ({
  useGroupStore: () => ({ getUserInfo: vi.fn(() => undefined), getUser: vi.fn(() => undefined) })
}))

vi.mock('@/utils/RenderReplyContent.ts', () => ({
  renderReplyContent: vi.fn(() => '')
}))

const createMessage = (atUidList: string[]): MessageType =>
  ({
    message: {
      id: `$msg:${Math.random()}`,
      roomId: '!room:server',
      sendTime: Date.now(),
      type: MsgEnum.TEXT,
      body: { content: 'hello', atUidList }
    },
    fromUser: { uid: '@sender:server' }
  }) as MessageType

const atMe = () => createMessage([currentUid])
const plain = () => createMessage([])

describe('useReplaceMsg.checkRoomAtMe', () => {
  const { checkRoomAtMe } = useReplaceMsg()

  it('群聊未读窗口内存在 @我 消息 → true', () => {
    const messages = [plain(), plain(), atMe()]

    expect(checkRoomAtMe('!room:server', RoomTypeEnum.GROUP, '!current:server', messages, 1)).toBe(true)
  })

  it('@我 消息落在未读窗口之外 → false', () => {
    const messages = [atMe(), plain(), plain()]

    expect(checkRoomAtMe('!room:server', RoomTypeEnum.GROUP, '!current:server', messages, 2)).toBe(false)
  })

  it('未读数为 0 时不提示（历史语义保持）', () => {
    const messages = [plain(), atMe()]

    expect(checkRoomAtMe('!room:server', RoomTypeEnum.GROUP, '!current:server', messages, 0)).toBe(false)
  })

  it('未读数超过消息总数时按全量扫描处理', () => {
    const messages = [atMe(), plain()]

    expect(checkRoomAtMe('!room:server', RoomTypeEnum.GROUP, '!current:server', messages, 99)).toBe(true)
  })

  it('非群聊不提示', () => {
    expect(checkRoomAtMe('!room:server', RoomTypeEnum.SINGLE, '!current:server', [atMe()], 1)).toBe(false)
  })

  it('当前激活会话不提示', () => {
    expect(checkRoomAtMe('!room:server', RoomTypeEnum.GROUP, '!room:server', [atMe()], 1)).toBe(false)
  })

  it('空消息列表不提示', () => {
    expect(checkRoomAtMe('!room:server', RoomTypeEnum.GROUP, '!current:server', [], 5)).toBe(false)
  })
})
