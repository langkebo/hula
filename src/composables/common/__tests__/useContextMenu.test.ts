import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  buildFriendMenu,
  buildRoomMenu,
  buildSpaceMenu,
  type ContextMenuItem,
  createMenuActionHandler,
  filterVisibleItems
} from '../useContextMenu'

// === Mock vue-i18n ===
vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => {
      const dict: Record<string, string> = {
        'friend.context.send_message': '进入聊天',
        'friend.context.encrypted_chat': '加密聊天',
        'friend.context.voice_call': '语音通话',
        'friend.context.video_call': '视频通话',
        'friend.context.open_in_new_window': '在新窗口打开',
        'friend.context.set_remark': '设置备注',
        'friend.context.favorite': '设为收藏',
        'friend.context.unfavorite': '取消收藏',
        'friend.context.block': '屏蔽好友',
        'friend.context.unblock': '取消屏蔽',
        'friend.context.remove': '删除好友',
        'room.context.enter_chat': '进入聊天',
        'room.context.video_call': '视频通话',
        'room.context.open_in_new_window': '在新窗口打开',
        'room.context.invite_members': '邀请成员',
        'room.context.edit_room': '修改房间信息',
        'room.context.set_visibility': '设置可见性',
        'room.context.leave_room': '离开房间',
        'room.context.forget_room': '忘记房间',
        'space.context.enter_chat': '进入聊天',
        'space.context.open_in_new_window': '在新窗口打开',
        'space.context.edit_space': '编辑空间',
        'space.context.invite_members': '邀请成员',
        'space.context.manage_children': '管理子房间',
        'space.context.leave_space': '离开空间',
        'space.context.delete_space': '删除空间'
      }
      return dict[key] ?? key
    }
  })
}))

// === Mock SessionItem 类型 ===
const makeRoom = (overrides: Record<string, unknown> = {}) => ({
  roomId: '!room1:example.com',
  name: 'Test Room',
  avatar: '',
  type: 'group' as const,
  membership: 'join' as const,
  unreadCount: 0,
  highlightCount: 0,
  notificationCount: 0,
  lastMsg: '',
  lastMsgTime: '',
  isAtMe: false,
  isTombstoned: false,
  ...overrides
})

const makeFriend = (overrides: Record<string, unknown> = {}) => ({
  userId: '@alice:example.com',
  name: 'Alice',
  displayName: 'Alice',
  avatarUrl: '',
  remark: '',
  friendStatus: 'normal' as const,
  activeStatus: 'offline' as const,
  statusMessage: '',
  ...overrides
})

const makeSpace = (overrides: Record<string, unknown> = {}) => ({
  spaceId: '!space1:example.com',
  name: 'Test Space',
  childCount: 0,
  avatarUrl: '',
  topic: '',
  memberCount: 0,
  isPinned: false,
  isLowPriority: false,
  isPublic: false,
  unreadCount: 0,
  statusText: '',
  statusTone: 'neutral' as const,
  visibilityText: '',
  ...overrides
})

describe('buildFriendMenu', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('builds complete friend menu with all 9 actions and 2 separators (per 5.4)', () => {
    const menu = buildFriendMenu(makeFriend() as never)

    const items = menu.filter((i) => i.type === 'item')
    const separators = menu.filter((i) => i.type === 'separator')

    // 9 项操作（含 open-in-new-window）
    expect(items).toHaveLength(9)
    // 2 个分隔符（在 4-5、8-9 之间）
    expect(separators).toHaveLength(2)

    // 主操作"进入聊天"标记为 primary
    expect(items[0]).toMatchObject({ key: 'enter-chat', primary: true })
    // 删除好友标记为 danger
    expect(items[8]).toMatchObject({ key: 'delete-friend', danger: true })
  })

  it('includes "open-in-new-window" at end of group 1 with expand icon', () => {
    const menu = buildFriendMenu(makeFriend() as never)
    const items = menu.filter((i) => i.type === 'item')

    // group 1 的最后一项应为 open-in-new-window
    const openItem = items[4]
    expect(openItem).toMatchObject({
      type: 'item',
      key: 'open-in-new-window',
      label: '在新窗口打开',
      icon: 'expand'
    })

    // 紧随其后应为分隔符
    expect(menu[5]?.type).toBe('separator')
  })

  it('shows "设为收藏" when friend is not favorite', () => {
    const menu = buildFriendMenu(makeFriend({ friendStatus: 'normal' }) as never)
    const toggleFav = menu.find((i) => i.type === 'item' && i.key === 'toggle-favorite')
    expect(toggleFav).toMatchObject({ label: '设为收藏' })
  })

  it('shows "取消收藏" when friend is favorite', () => {
    const menu = buildFriendMenu(makeFriend({ friendStatus: 'favorite' }) as never)
    const toggleFav = menu.find((i) => i.type === 'item' && i.key === 'toggle-favorite')
    expect(toggleFav).toMatchObject({ label: '取消收藏' })
  })

  it('shows "取消屏蔽" when friend is blocked', () => {
    const menu = buildFriendMenu(makeFriend({ friendStatus: 'blocked' }) as never)
    const toggleBlock = menu.find((i) => i.type === 'item' && i.key === 'toggle-block')
    expect(toggleBlock).toMatchObject({ label: '取消屏蔽' })
  })

  it('separator positions match spec (after open-in-new-window, after toggle-block)', () => {
    const menu = buildFriendMenu(makeFriend() as never)
    // 0-4: enter-chat, encrypted-chat, voice-call, video-call, open-in-new-window
    expect(menu[5]?.type).toBe('separator')
    // 6-8: set-remark, toggle-favorite, toggle-block
    expect(menu[9]?.type).toBe('separator')
    // 10: delete-friend
    expect(menu[10]).toMatchObject({ key: 'delete-friend' })
  })
})

describe('buildRoomMenu', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('builds complete room menu with all 8 actions and 2 separators (per 5.4)', () => {
    const menu = buildRoomMenu(makeRoom() as never)

    const items = menu.filter((i) => i.type === 'item')
    const separators = menu.filter((i) => i.type === 'separator')

    // 8 项操作（含 open-in-new-window）
    expect(items).toHaveLength(8)
    // 2 个分隔符
    expect(separators).toHaveLength(2)

    expect(items[0]).toMatchObject({ key: 'enter-chat', primary: true })
    expect(items[7]).toMatchObject({ key: 'forget-room', danger: true })
  })

  it('includes "open-in-new-window" at end of group 1 with expand icon', () => {
    const menu = buildRoomMenu(makeRoom() as never)
    const items = menu.filter((i) => i.type === 'item')

    // group 1 的最后一项应为 open-in-new-window
    const openItem = items[2]
    expect(openItem).toMatchObject({
      type: 'item',
      key: 'open-in-new-window',
      label: '在新窗口打开',
      icon: 'expand'
    })

    // 紧随其后应为分隔符
    expect(menu[3]?.type).toBe('separator')
  })

  it('hides management actions when membership is leave', () => {
    const menu = buildRoomMenu(makeRoom({ membership: 'leave' }) as never)
    const items = menu.filter((i) => i.type === 'item') as Extract<ContextMenuItem, { type: 'item' }>[]

    // 仅保留 enter-chat, open-in-new-window 和 forget-room（其他 visible:false）
    const visibleKeys = items.filter((i) => i.visible !== false).map((i) => i.key)
    expect(visibleKeys).toEqual(['enter-chat', 'open-in-new-window', 'forget-room'])
  })

  it('hides management actions when membership is ban', () => {
    const menu = buildRoomMenu(makeRoom({ membership: 'ban' }) as never)
    const items = menu.filter((i) => i.type === 'item') as Extract<ContextMenuItem, { type: 'item' }>[]

    const visibleKeys = items.filter((i) => i.visible !== false).map((i) => i.key)
    expect(visibleKeys).toEqual(['enter-chat', 'open-in-new-window', 'forget-room'])
  })

  it('shows all actions when membership is join', () => {
    const menu = buildRoomMenu(makeRoom({ membership: 'join' }) as never)
    const items = menu.filter((i) => i.type === 'item') as Extract<ContextMenuItem, { type: 'item' }>[]

    const visibleKeys = items.filter((i) => i.visible !== false).map((i) => i.key)
    expect(visibleKeys).toEqual([
      'enter-chat',
      'video-call',
      'open-in-new-window',
      'invite-members',
      'edit-room',
      'set-visibility',
      'leave-room',
      'forget-room'
    ])
  })
})

describe('buildSpaceMenu', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('builds complete space menu with all 7 actions and 2 separators (per 5.4)', () => {
    const menu = buildSpaceMenu(makeSpace() as never)

    const items = menu.filter((i) => i.type === 'item')
    const separators = menu.filter((i) => i.type === 'separator')

    // 7 项操作（含 open-in-new-window）
    expect(items).toHaveLength(7)
    // 2 个分隔符
    expect(separators).toHaveLength(2)

    expect(items[0]).toMatchObject({ key: 'enter-chat', primary: true })
    expect(items[6]).toMatchObject({ key: 'delete-space', danger: true })
  })

  it('includes "open-in-new-window" at end of group 1 with expand icon', () => {
    const menu = buildSpaceMenu(makeSpace() as never)
    const items = menu.filter((i) => i.type === 'item')

    // group 1 的最后一项应为 open-in-new-window
    const openItem = items[1]
    expect(openItem).toMatchObject({
      type: 'item',
      key: 'open-in-new-window',
      label: '在新窗口打开',
      icon: 'expand'
    })

    // 紧随其后应为分隔符
    expect(menu[2]?.type).toBe('separator')
  })

  it('separator positions match spec (after open-in-new-window, after manage-children)', () => {
    const menu = buildSpaceMenu(makeSpace() as never)
    // 0: enter-chat
    expect(menu[0]).toMatchObject({ key: 'enter-chat' })
    // 1: open-in-new-window
    expect(menu[1]).toMatchObject({ key: 'open-in-new-window' })
    // 2: separator
    expect(menu[2]?.type).toBe('separator')
    // 3-5: edit-space, invite-members, manage-children
    expect(menu[3]).toMatchObject({ key: 'edit-space' })
    expect(menu[4]).toMatchObject({ key: 'invite-members' })
    expect(menu[5]).toMatchObject({ key: 'manage-children' })
    // 6: separator
    expect(menu[6]?.type).toBe('separator')
    // 7-8: leave-space, delete-space
    expect(menu[7]).toMatchObject({ key: 'leave-space' })
    expect(menu[8]).toMatchObject({ key: 'delete-space' })
  })
})

describe('filterVisibleItems', () => {
  it('removes items with visible: false', () => {
    const items: ContextMenuItem[] = [
      { type: 'item', key: 'enter-chat', label: 'A', icon: 'a' },
      { type: 'separator' },
      { type: 'item', key: 'leave-room', label: 'B', icon: 'b', visible: false },
      { type: 'item', key: 'delete-friend', label: 'C', icon: 'c', danger: true }
    ]

    const filtered = filterVisibleItems(items)

    expect(filtered).toHaveLength(3)
    expect(filtered[0]).toMatchObject({ key: 'enter-chat' })
    expect(filtered[1]?.type).toBe('separator')
    expect(filtered[2]).toMatchObject({ key: 'delete-friend' })
  })

  it('removes leading/trailing/consecutive separators', () => {
    const items: ContextMenuItem[] = [
      { type: 'separator' },
      { type: 'separator' },
      { type: 'item', key: 'enter-chat', label: 'A', icon: 'a' },
      { type: 'separator' },
      { type: 'separator' },
      { type: 'item', key: 'delete-friend', label: 'B', icon: 'b' },
      { type: 'separator' }
    ]

    const filtered = filterVisibleItems(items)

    expect(filtered).toEqual([
      { type: 'item', key: 'enter-chat', label: 'A', icon: 'a' },
      { type: 'separator' },
      { type: 'item', key: 'delete-friend', label: 'B', icon: 'b' }
    ])
  })

  it('returns empty array when all items are invisible', () => {
    const items: ContextMenuItem[] = [
      { type: 'item', key: 'enter-chat', label: 'A', icon: 'a', visible: false },
      { type: 'separator' },
      { type: 'item', key: 'delete-friend', label: 'B', icon: 'b', visible: false }
    ]

    expect(filterVisibleItems(items)).toEqual([])
  })

  it('handles empty input', () => {
    expect(filterVisibleItems([])).toEqual([])
  })
})

describe('createMenuActionHandler', () => {
  it('calls openInNewWindow with roomId for open-in-new-window action', async () => {
    const openInNewWindow = vi.fn().mockResolvedValue(undefined)
    const navigate = vi.fn().mockResolvedValue(undefined)
    const emitScroll = vi.fn()
    const handler = createMenuActionHandler({ openInNewWindow, navigate, emitScroll })

    await handler('open-in-new-window', { roomId: '!room1:example.com' })

    expect(openInNewWindow).toHaveBeenCalledWith('!room1:example.com')
    expect(navigate).not.toHaveBeenCalled()
    expect(emitScroll).not.toHaveBeenCalled()
  })

  it('navigates to /room/{roomId} and emits scroll for edit-room action', async () => {
    const openInNewWindow = vi.fn().mockResolvedValue(undefined)
    const navigate = vi.fn().mockResolvedValue(undefined)
    const emitScroll = vi.fn()
    const handler = createMenuActionHandler({ openInNewWindow, navigate, emitScroll })

    await handler('edit-room', { roomId: '!room1:example.com' })

    expect(navigate).toHaveBeenCalledWith('/room/!room1:example.com')
    expect(emitScroll).toHaveBeenCalledWith('room-name')
    expect(openInNewWindow).not.toHaveBeenCalled()
  })

  it('navigates to /room/{roomId} and emits scroll for set-visibility action', async () => {
    const openInNewWindow = vi.fn().mockResolvedValue(undefined)
    const navigate = vi.fn().mockResolvedValue(undefined)
    const emitScroll = vi.fn()
    const handler = createMenuActionHandler({ openInNewWindow, navigate, emitScroll })

    await handler('set-visibility', { roomId: '!room1:example.com' })

    expect(navigate).toHaveBeenCalledWith('/room/!room1:example.com')
    expect(emitScroll).toHaveBeenCalledWith('visibility')
    expect(openInNewWindow).not.toHaveBeenCalled()
  })

  it('navigates to /space/{spaceId} for manage-children action', async () => {
    const openInNewWindow = vi.fn().mockResolvedValue(undefined)
    const navigate = vi.fn().mockResolvedValue(undefined)
    const emitScroll = vi.fn()
    const handler = createMenuActionHandler({ openInNewWindow, navigate, emitScroll })

    await handler('manage-children', { spaceId: '!space1:example.com' })

    expect(navigate).toHaveBeenCalledWith('/space/!space1:example.com')
    expect(emitScroll).not.toHaveBeenCalled()
    expect(openInNewWindow).not.toHaveBeenCalled()
  })

  it('does nothing when roomId is missing for open-in-new-window', async () => {
    const openInNewWindow = vi.fn().mockResolvedValue(undefined)
    const navigate = vi.fn().mockResolvedValue(undefined)
    const emitScroll = vi.fn()
    const handler = createMenuActionHandler({ openInNewWindow, navigate, emitScroll })

    await handler('open-in-new-window', {})

    expect(openInNewWindow).not.toHaveBeenCalled()
    expect(navigate).not.toHaveBeenCalled()
  })

  it('does nothing when roomId is missing for edit-room', async () => {
    const openInNewWindow = vi.fn().mockResolvedValue(undefined)
    const navigate = vi.fn().mockResolvedValue(undefined)
    const emitScroll = vi.fn()
    const handler = createMenuActionHandler({ openInNewWindow, navigate, emitScroll })

    await handler('edit-room', {})

    expect(navigate).not.toHaveBeenCalled()
    expect(emitScroll).not.toHaveBeenCalled()
  })

  it('does nothing when spaceId is missing for manage-children', async () => {
    const openInNewWindow = vi.fn().mockResolvedValue(undefined)
    const navigate = vi.fn().mockResolvedValue(undefined)
    const emitScroll = vi.fn()
    const handler = createMenuActionHandler({ openInNewWindow, navigate, emitScroll })

    await handler('manage-children', {})

    expect(navigate).not.toHaveBeenCalled()
  })
})
