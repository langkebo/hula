import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MessageStatusEnum, MsgEnum } from '@/enums'

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

const { getRoomEventMediaUrlsMock, writeMock, getRoomEventUrlMock, saveTextFileAsMock } = vi.hoisted(() => ({
  getRoomEventMediaUrlsMock: vi.fn(),
  writeMock: vi.fn(),
  getRoomEventUrlMock: vi.fn(),
  saveTextFileAsMock: vi.fn()
}))

vi.mock('@/services/matrix/room/RoomFacade', () => ({
  matrixRoomActionFacade: {},
  matrixRoomReadFacade: { getRoomEventMediaUrls: getRoomEventMediaUrlsMock, getRoomEventUrl: getRoomEventUrlMock }
}))

vi.mock('@/composables/common/useClipboard', () => ({
  useClipboard: () => ({ write: writeMock })
}))

vi.mock('@/composables/chat/openMsgSession', () => ({ openMsgSession: vi.fn() }))

vi.mock('@/utils/AttachmentSaver', () => ({
  saveFileAttachmentAs: vi.fn(),
  saveVideoAttachmentAs: vi.fn(),
  saveTextFileAs: saveTextFileAsMock
}))

import { createContextMenuLists } from '@/composables/chat/contextMenuLists'

const makeLists = (
  options: {
    isDesktop?: boolean
    isHistoryMode?: boolean
    showFeedback?: ReturnType<typeof vi.fn>
    /** 当前用户 uid（「已读明细」按发件人判定可见性） */
    userUid?: string
    /** 复制回调（「复制附件地址」用例需要断言） */
    handleCopy?: ReturnType<typeof vi.fn>
  } = {}
) =>
  createContextMenuLists({
    t: ((key: string) => key) as never,
    showFeedback: (options.showFeedback ?? vi.fn()) as never,
    isDesktop: options.isDesktop ?? true,
    isHistoryMode: options.isHistoryMode ?? false,
    disableHistoryActions: false,
    downloadFile: vi.fn() as never,
    fileDownload: {
      downloadAndRevealFile: vi.fn(),
      downloadAndRevealVideo: vi.fn(),
      previewFile: vi.fn()
    } as never,
    handleCopy: (options.handleCopy ?? vi.fn()) as never,
    helpers: {
      checkFriendRelation: () => true,
      handleForward: vi.fn(),
      shouldHideCopy: () => false,
      isNoticeMessage: () => false,
      showComingSoon: vi.fn()
    } as never,
    chatStore: {} as never,
    emojiStore: {} as never,
    userStore: (options.userUid ? { userInfo: { uid: options.userUid } } : {}) as never,
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
  /** 与 `ContextMenu.vue` 一致的可见性过滤：未声明 `visible` 视为常显 */
  const visibleIcons = (menus: OPT.RightMenu[], item: unknown) =>
    menus.filter((menu) => (typeof menu.visible === 'function' ? menu.visible(item) : true)).map((menu) => menu.icon)

  const fakeFileMessage = {
    message: {
      id: '$event',
      roomId: '!room:hs',
      type: MsgEnum.FILE,
      body: { url: 'mxc://hs/file', fileName: 'a.pdf' }
    }
  }

  it('handleItemType 按消息类型分流到对应列表', () => {
    const lists = makeLists()

    expect(lists.handleItemType(MsgEnum.IMAGE)).toBe(lists.imageMenuList.value)
    expect(lists.handleItemType(MsgEnum.EMOJI)).toBe(lists.imageMenuList.value)
    expect(lists.handleItemType(MsgEnum.FILE)).toBe(lists.fileMenuList.value)
    expect(lists.handleItemType(MsgEnum.VIDEO)).toBe(lists.videoMenuList.value)
    expect(lists.handleItemType(MsgEnum.TEXT)).toBe(lists.menuList.value)
  })

  it('「已读明细」仅对自己发出的消息可见', () => {
    const lists = makeLists({ userUid: '@me:hs' })
    const menu = lists.specialMenuList
      .value(MsgEnum.TEXT)
      .find(
        (item) => (typeof item.label === 'function' ? item.label({} as never) : item.label) === 'menu.read_receipts'
      )
    expect(menu).toBeTruthy()
    if (!menu?.visible) throw new Error('菜单项应声明 visible')

    const selfItem = {
      message: { id: '$e1', roomId: '!r:hs', type: MsgEnum.TEXT, body: {} },
      fromUser: { uid: '@me:hs' }
    }
    const otherItem = {
      message: { id: '$e2', roomId: '!r:hs', type: MsgEnum.TEXT, body: {} },
      fromUser: { uid: '@other:hs' }
    }

    expect(menu.visible(selfItem as never)).toBe(true)
    expect(menu.visible(otherItem as never)).toBe(false)
  })

  it('「复制附件地址」按 body.url 决定可见性，点击后取服务端地址再复制', async () => {
    const handleCopy = vi.fn()
    const lists = makeLists({ handleCopy })
    const menu = lists.specialMenuList
      .value(MsgEnum.TEXT)
      .find(
        (item) =>
          (typeof item.label === 'function' ? item.label({} as never) : item.label) === 'menu.copy_attachment_url'
      )
    expect(menu).toBeTruthy()
    if (!menu?.visible) throw new Error('菜单项应声明 visible')

    const withUrl = {
      message: { id: '$e1', roomId: '!r:hs', type: MsgEnum.IMAGE, body: { url: 'mxc://hs/a' } },
      fromUser: { uid: '@me:hs' }
    }
    const withoutUrl = {
      message: { id: '$e2', roomId: '!r:hs', type: MsgEnum.TEXT, body: { content: 'hi' } },
      fromUser: { uid: '@me:hs' }
    }
    expect(menu.visible(withUrl as never)).toBe(true)
    expect(menu.visible(withoutUrl as never)).toBe(false)

    getRoomEventUrlMock.mockResolvedValue({
      status: 'ok',
      attachment: { url: 'https://cdn.example.com/a.png', mxc: 'mxc://hs/a', contentType: null, filesize: null }
    })
    await (menu.click as (item: never) => Promise<void>)(withUrl as never)

    expect(getRoomEventUrlMock).toHaveBeenCalledWith('!r:hs', '$e1')
    expect(handleCopy).toHaveBeenCalledWith('https://cdn.example.com/a.png', true, '$e1')
  })

  it('「导出为 HTML」仅对纯文本消息可见，且点击后写入 HTML 文件', async () => {
    const lists = makeLists()
    const menu = lists.specialMenuList
      .value(MsgEnum.TEXT)
      .find(
        (item) =>
          (typeof item.label === 'function' ? item.label({} as never) : item.label) === 'menu.export_message_html'
      )
    expect(menu).toBeTruthy()
    if (!menu?.visible) throw new Error('菜单项应声明 visible')

    const textItem = {
      message: {
        id: '$e9',
        roomId: '!r:hs',
        type: MsgEnum.TEXT,
        sendTime: 1700000000000,
        body: { content: 'hello <b>' }
      },
      fromUser: { uid: '@me:hs', username: '我' }
    }
    const imageItem = {
      message: { id: '$e10', roomId: '!r:hs', type: MsgEnum.IMAGE, body: { url: 'mxc://hs/a' } },
      fromUser: { uid: '@me:hs' }
    }
    expect(menu.visible(textItem as never)).toBe(true)
    expect(menu.visible(imageItem as never)).toBe(false)

    await (menu.click as (item: never) => Promise<void>)(textItem as never)

    expect(saveTextFileAsMock).toHaveBeenCalledTimes(1)
    const arg = saveTextFileAsMock.mock.calls[0][0]
    expect(arg.defaultFileName).toMatch(/\.html$/)
    // 正文里的标签必须已转义
    expect(arg.content).toContain('&lt;b&gt;')
    expect(arg.content).not.toContain('hello <b>')
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

  it('正常模式 specialMenuList 输出删除与消息视角，删除仅对本地/失败消息可见', () => {
    const lists = makeLists()
    const icons = lists.specialMenuList.value(MsgEnum.TEXT).map((menu) => menu.icon)

    expect(icons).toEqual(['delete', 'info', 'check', 'link', 'download'])

    const deleteMenu = lists.specialMenuList.value(MsgEnum.TEXT).find((menu) => menu.icon === 'delete') as {
      visible?: (item: never) => boolean
    }
    const sentMessage = {
      message: { id: '$event', roomId: '!room:hs', type: MsgEnum.TEXT, body: {}, status: MessageStatusEnum.SUCCESS }
    }
    const failedMessage = {
      message: { id: '$event', roomId: '!room:hs', type: MsgEnum.TEXT, body: {}, status: MessageStatusEnum.FAILED }
    }

    expect(deleteMenu.visible?.(sentMessage as never)).toBe(false)
    expect(deleteMenu.visible?.(failedMessage as never)).toBe(true)
  })

  it('移动端不输出预览与在文件夹中显示的桌面专属项', () => {
    const lists = makeLists({ isDesktop: false })

    expect(visibleIcons(lists.videoMenuList.value, fakeFileMessage)).not.toContain('file2')
    expect(visibleIcons(lists.fileMenuList.value, fakeFileMessage)).not.toContain('preview-open')
    expect(visibleIcons(lists.fileMenuList.value, fakeFileMessage)).not.toContain('file2')
    expect(visibleIcons(lists.imageMenuList.value, fakeFileMessage)).not.toContain('file2')
  })

  it('移动端历史模式同样不输出在文件夹中显示的桌面专属项', () => {
    const lists = makeLists({ isDesktop: false, isHistoryMode: true })
    const icons = visibleIcons(lists.specialMenuList.value(MsgEnum.FILE), fakeFileMessage)

    expect(icons).not.toContain('file2')
    expect(icons).toContain('copy')
  })

  it('桌面端保留预览与在文件夹中显示的桌面专属项', () => {
    const lists = makeLists({ isDesktop: true })

    expect(visibleIcons(lists.videoMenuList.value, fakeFileMessage)).toContain('file2')
    expect(visibleIcons(lists.fileMenuList.value, fakeFileMessage)).toContain('preview-open')
    expect(visibleIcons(lists.fileMenuList.value, fakeFileMessage)).toContain('file2')
    expect(visibleIcons(lists.imageMenuList.value, fakeFileMessage)).toContain('file2')

    const historyLists = makeLists({ isDesktop: true, isHistoryMode: true })
    expect(visibleIcons(historyLists.specialMenuList.value(MsgEnum.FILE), fakeFileMessage)).toContain('file2')
  })
})

describe('复制媒体链接（ROOM-03）', () => {
  const imageMessage = {
    message: { id: '$img', roomId: '!room:hs', type: MsgEnum.IMAGE, body: { url: 'mxc://hs/img' } }
  }
  const textMessage = {
    message: { id: '$txt', roomId: '!room:hs', type: MsgEnum.TEXT, body: { content: 'hi' } }
  }
  const linkItem = (lists: ReturnType<typeof makeLists>) => lists.menuList.value.find((menu) => menu.icon === 'link')

  beforeEach(() => {
    getRoomEventMediaUrlsMock.mockReset()
    writeMock.mockReset()
  })

  it('仅媒体消息显示该项', () => {
    const lists = makeLists()
    expect(
      (lists.menuList.value as Array<{ icon?: string; visible?: (item: unknown) => boolean }>)
        .filter((menu) => menu.icon === 'link')
        .map((menu) => menu.visible?.(imageMessage))
    ).toEqual([true])
    expect(
      (lists.menuList.value as Array<{ icon?: string; visible?: (item: unknown) => boolean }>)
        .filter((menu) => menu.icon === 'link')
        .map((menu) => menu.visible?.(textMessage))
    ).toEqual([false])
  })

  it('复制解析后的 http 地址并提示成功', async () => {
    const showFeedback = vi.fn()
    getRoomEventMediaUrlsMock.mockResolvedValue({
      status: 'ok',
      urls: [{ type: 'mxc', url: 'mxc://hs/img', field: 'content.url', httpUrl: 'https://media.example/hs/img' }]
    })
    writeMock.mockResolvedValue(undefined)

    await linkItem(makeLists({ showFeedback }))?.click?.(imageMessage as never)

    expect(getRoomEventMediaUrlsMock).toHaveBeenCalledWith('!room:hs', '$img')
    expect(writeMock).toHaveBeenCalledWith('https://media.example/hs/img')
    expect(showFeedback).toHaveBeenCalledWith('menu.copy_media_link_success', 'success')
  })

  it('没有附件时提示为空而不静默', async () => {
    const showFeedback = vi.fn()
    getRoomEventMediaUrlsMock.mockResolvedValue({ status: 'empty' })

    await linkItem(makeLists({ showFeedback }))?.click?.(imageMessage as never)

    expect(writeMock).not.toHaveBeenCalled()
    expect(showFeedback).toHaveBeenCalledWith('menu.copy_media_link_empty', 'warning')
  })

  it('读取失败时提示失败', async () => {
    const showFeedback = vi.fn()
    getRoomEventMediaUrlsMock.mockResolvedValue({ status: 'error' })

    await linkItem(makeLists({ showFeedback }))?.click?.(imageMessage as never)

    expect(showFeedback).toHaveBeenCalledWith('menu.copy_media_link_failed', 'error')
  })

  it('剪贴板写入失败时提示失败', async () => {
    const showFeedback = vi.fn()
    getRoomEventMediaUrlsMock.mockResolvedValue({
      status: 'ok',
      urls: [{ type: 'mxc', url: 'mxc://hs/img', field: 'content.url', httpUrl: null }]
    })
    writeMock.mockRejectedValue(new Error('clipboard denied'))

    await linkItem(makeLists({ showFeedback }))?.click?.(imageMessage as never)

    expect(writeMock).toHaveBeenCalledWith('mxc://hs/img')
    expect(showFeedback).toHaveBeenCalledWith('menu.copy_media_link_failed', 'error')
  })
})
