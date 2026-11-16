import { describe, expect, it, vi } from 'vitest'
import { MsgEnum } from '@/enums'

/**
 * 右键菜单列表装配层（P0-13 拆分后的回归护栏）。
 *
 * `createContextMenuLists` 由三个子模块装配：消息菜单、媒体菜单、群成员菜单。
 * 这里只验证装配结果本身——各列表都暴露出来，且 `handleItemType` 仍按消息类型
 * 分流到对应列表，避免拆分后把某个列表接错或漏接。
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

const makeLists = () =>
  createContextMenuLists({
    t: ((key: string) => key) as never,
    showFeedback: vi.fn() as never,
    isDesktop: true,
    isHistoryMode: false,
    disableHistoryActions: false,
    downloadFile: vi.fn() as never,
    fileDownload: {
      downloadAndRevealFile: vi.fn(),
      downloadAndRevealVideo: vi.fn(),
      previewFile: vi.fn()
    } as never,
    handleCopy: vi.fn() as never,
    openDeleteConfirm: vi.fn(),
    helpers: {
      checkFriendRelation: () => true,
      handleForward: vi.fn(),
      shouldHideCopy: () => false,
      isNoticeMessage: () => false,
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

describe('右键菜单列表装配', () => {
  it('handleItemType 按消息类型分流到对应列表', () => {
    const lists = makeLists()

    expect(lists.handleItemType(MsgEnum.IMAGE)).toBe(lists.imageMenuList.value)
    expect(lists.handleItemType(MsgEnum.EMOJI)).toBe(lists.imageMenuList.value)
    expect(lists.handleItemType(MsgEnum.FILE)).toBe(lists.fileMenuList.value)
    expect(lists.handleItemType(MsgEnum.VIDEO)).toBe(lists.videoMenuList.value)
    expect(lists.handleItemType(MsgEnum.TEXT)).toBe(lists.menuList.value)
  })

  it('媒体菜单复用通用菜单项实例，而非复制一份', () => {
    const lists = makeLists()
    const commonSelect = lists.commonMenuList.value.find((menu) => menu.icon === 'list-checkbox')

    expect(commonSelect).toBeTruthy()
    expect(lists.videoMenuList.value).toContain(commonSelect)
    expect(lists.fileMenuList.value).toContain(commonSelect)
    expect(lists.imageMenuList.value).toContain(commonSelect)
    expect(lists.menuList.value).toContain(commonSelect)
  })

  it('群成员菜单与举报选项仍然暴露', () => {
    const lists = makeLists()

    expect(lists.optionsList.value.length).toBe(7)
    expect(lists.optionsList.value.map((menu) => menu.icon)).toEqual([
      'message-action',
      'aite',
      'notes',
      'edit',
      'people-plus',
      'people-safe',
      'reduce-user'
    ])
    expect(lists.report.value.map((menu) => menu.icon)).toEqual(['people-delete-one', 'caution'])
  })

  it('正常模式 specialMenuList 输出删除与消息视角', () => {
    const lists = makeLists()
    const icons = lists.specialMenuList.value(MsgEnum.TEXT).map((menu) => menu.icon)

    expect(icons).toEqual(['delete', 'info'])
  })
})
