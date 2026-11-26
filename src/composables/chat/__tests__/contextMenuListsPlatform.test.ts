import { describe, expect, it, vi } from 'vitest'
import { MsgEnum } from '@/enums'

/**
 * 右键菜单的桌面专属项平台门控（§19.24 → P0-6）。
 *
 * 平台事实由 `useChatContextMenus` 取一次后注入 `createContextMenuLists`，
 * 菜单项用 `visible: () => isDesktop` 表达：移动端该项直接不可见，
 * 而不是「点了才提示敬请期待」。
 */
vi.mock('@/services/offline/OfflineQueueService', () => ({
  offlineQueueService: { getQueue: () => [], removeOperation: vi.fn() }
}))

vi.mock('@/services/matrix/messaging/MatrixMessageService', () => ({
  matrixMessageService: {
    isLocalEventId: () => false,
    getRemoteEventId: () => undefined,
    recallMessage: vi.fn()
  }
}))

vi.mock('@/services/matrix/room/RoomFacade', () => ({
  matrixRoomActionFacade: {},
  matrixRoomReadFacade: {}
}))

vi.mock('@/composables/chat/openMsgSession', () => ({ openMsgSession: vi.fn() }))

vi.mock('@/utils/AttachmentSaver', () => ({
  saveFileAttachmentAs: vi.fn(),
  saveVideoAttachmentAs: vi.fn()
}))

import { createContextMenuLists } from '@/composables/chat/contextMenuLists'

const makeLists = (isDesktop: boolean) =>
  createContextMenuLists({
    t: ((key: string) => key) as never,
    showFeedback: vi.fn() as never,
    isDesktop,
    isHistoryMode: true,
    disableHistoryActions: false,
    downloadFile: vi.fn() as never,
    fileDownload: {
      downloadAndRevealFile: vi.fn(),
      downloadAndRevealVideo: vi.fn(),
      previewFile: vi.fn()
    } as never,
    handleCopy: vi.fn() as never,
    helpers: {
      checkFriendRelation: () => true,
      handleForward: vi.fn(),
      shouldHideCopy: () => false,
      isNoticeMessage: (item: { message: { type: MsgEnum } }) => item.message.type === MsgEnum.NOTICE,
      showComingSoon: vi.fn()
    } as never,
    chatStore: {} as never,
    emojiStore: {} as never,
    userStore: {} as never,
    globalStore: {} as never,
    groupStore: {} as never,
    settingStore: {} as never,
    groupRoleGuard: {
      userUid: '@me:hs',
      isGroupManagementContext: false,
      resolveTargetRoleId: () => '',
      currentUserRoleId: '',
      isCurrentUserLord: false,
      canRecallMessage: () => true,
      isRecallExpired: () => false
    } as never
  })

const resolveLabel = (menu: OPT.RightMenu): string =>
  typeof menu.label === 'function' ? menu.label(undefined) : menu.label

const pickMenu = (menus: OPT.RightMenu[], labelKey: string): OPT.RightMenu => {
  const found = menus.find((menu) => resolveLabel(menu) === labelKey)
  if (!found) throw new Error(`菜单项不存在: ${labelKey}`)
  return found
}

const isVisible = (menu: OPT.RightMenu, item: unknown): boolean => {
  const { visible } = menu
  if (typeof visible === 'function') return visible(item)
  return visible !== false
}

const textMessage = { message: { type: MsgEnum.TEXT } }
const noticeMessage = { message: { type: MsgEnum.NOTICE } }

describe('右键菜单桌面专属项的平台门控', () => {
  it('通用菜单「转发」：桌面可见，移动端不可见，通知消息两端都不可见', () => {
    const desktop = pickMenu(makeLists(true).commonMenuList.value, 'menu.forward')
    const mobile = pickMenu(makeLists(false).commonMenuList.value, 'menu.forward')

    expect(isVisible(desktop, textMessage)).toBe(true)
    expect(isVisible(mobile, textMessage)).toBe(false)
    expect(isVisible(desktop, noticeMessage)).toBe(false)
  })

  it('视频菜单「复制」：仅桌面可见', () => {
    const desktop = pickMenu(makeLists(true).videoMenuList.value, 'menu.copy')
    const mobile = pickMenu(makeLists(false).videoMenuList.value, 'menu.copy')

    expect(isVisible(desktop, textMessage)).toBe(true)
    expect(isVisible(mobile, textMessage)).toBe(false)
  })

  it('视频菜单「另存为」：仅桌面可见', () => {
    const desktop = pickMenu(makeLists(true).videoMenuList.value, 'menu.save_as')
    const mobile = pickMenu(makeLists(false).videoMenuList.value, 'menu.save_as')

    expect(isVisible(desktop, textMessage)).toBe(true)
    expect(isVisible(mobile, textMessage)).toBe(false)
  })

  it('文件菜单「另存为」：仅桌面可见', () => {
    const desktop = pickMenu(makeLists(true).fileMenuList.value, 'menu.save_as')
    const mobile = pickMenu(makeLists(false).fileMenuList.value, 'menu.save_as')

    expect(isVisible(desktop, textMessage)).toBe(true)
    expect(isVisible(mobile, textMessage)).toBe(false)
  })

  it('图片菜单「另存为」：仅桌面可见', () => {
    const desktop = pickMenu(makeLists(true).imageMenuList.value, 'menu.save_as')
    const mobile = pickMenu(makeLists(false).imageMenuList.value, 'menu.save_as')

    expect(isVisible(desktop, textMessage)).toBe(true)
    expect(isVisible(mobile, textMessage)).toBe(false)
  })

  it('历史模式媒体菜单「另存为」：仅桌面可见', () => {
    const desktop = pickMenu(makeLists(true).specialMenuList.value(MsgEnum.IMAGE), 'menu.save_as')
    const mobile = pickMenu(makeLists(false).specialMenuList.value(MsgEnum.IMAGE), 'menu.save_as')

    expect(isVisible(desktop, textMessage)).toBe(true)
    expect(isVisible(mobile, textMessage)).toBe(false)
  })
})
