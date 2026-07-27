import type { Ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { SpaceListItem } from '@/components/workbench/SpaceListPane.vue'
import type { SessionItem } from '@/stores/domains/chat/chat'
import type { MatrixContact } from '@/stores/domains/chat/contacts'

/**
 * 房间右键菜单所需的最小上下文
 *
 * SessionItem 本身不含 membership 字段（membership 由 RoomSessionList 扩展），
 * 这里显式声明以便 buildRoomMenu 安全访问。
 */
export type RoomMenuContext = Pick<SessionItem, 'roomId' | 'name'> & {
  membership?: 'join' | 'leave' | 'invite' | 'ban'
}

/**
 * 右键菜单的状态管理
 * @param ContextMenuRef 右键菜单的容器
 * @param isNull 传入的容器是否为空
 */

export const useContextMenu = (ContextMenuRef: Ref, isNull?: Ref<boolean>) => {
  const showMenu = ref(false)
  const x = ref(0)
  const y = ref(0)

  // 禁止滚动的默认行为
  const preventDefault = (e: Event) => e.preventDefault()

  // 禁止选中文本的默认行为
  const preventTextSelection = (e: Event) => e.preventDefault()

  // 禁用文本选择
  const disableTextSelection = () => {
    // 清除当前选择
    window.getSelection()?.removeAllRanges()
    // 添加禁止选择事件
    document.body.classList.add('no-select')
    window.addEventListener('selectstart', preventTextSelection)
  }

  // 启用文本选择
  const enableTextSelection = () => {
    document.body.classList.remove('no-select')
    window.removeEventListener('selectstart', preventTextSelection)
  }

  /**! 解决使用n-virtual-list时，右键菜单出现还可以滚动的问题 */
  const handleVirtualListScroll = (isBan: boolean) => {
    const scrollbar_main = document.querySelector('#image-chat-main') as HTMLElement
    const scrollbar_sidebar = document.querySelector('#image-chat-sidebar') as HTMLElement

    scrollbar_main && (scrollbar_main.style.pointerEvents = isBan ? 'none' : '')
    scrollbar_sidebar && (scrollbar_sidebar.style.pointerEvents = isBan ? 'none' : '')
  }

  const isSelectionInsideContext = () => {
    const selection = window.getSelection()
    if (!selection?.anchorNode || !selection?.focusNode) return false

    const contextEl = ContextMenuRef.value as HTMLElement | null
    if (!contextEl) return false

    const resolveElement = (node: Node | null) => {
      if (!node) return null
      return node.nodeType === Node.ELEMENT_NODE ? (node as Element) : node.parentElement
    }

    const anchorElement = resolveElement(selection.anchorNode)
    const focusElement = resolveElement(selection.focusNode)
    if (!anchorElement || !focusElement) return false

    return contextEl.contains(anchorElement) && contextEl.contains(focusElement)
  }

  const handleContextMenu = (e: MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (isNull?.value) return

    // 如果当前右键目标包含了已有的文本选择，则保留用户选择，避免影响复制/翻译
    if (!isSelectionInsideContext()) {
      // 在显示菜单前清除选择
      disableTextSelection()
    }

    handleVirtualListScroll(true)
    showMenu.value = true
    x.value = e.clientX
    y.value = e.clientY
    window.addEventListener('wheel', preventDefault, { passive: false }) // 禁止使用滚轮滚动页面
  }

  const closeMenu = (event: MouseEvent) => {
    /** 需要判断点击如果不是.context-menu类的元素的时候，menu才会关闭 */
    if (!(event.target as HTMLElement | null)?.matches('.context-menu, .context-menu *')) {
      handleVirtualListScroll(false)
      showMenu.value = false
      enableTextSelection() // 恢复文本选择功能
    }
    window.removeEventListener('wheel', preventDefault) // 移除禁止滚轮滚动
  }

  // 监听showMenu状态变化
  watch(
    () => showMenu.value,
    (newValue) => {
      if (!newValue) {
        // 当菜单关闭时，恢复文本选择功能
        enableTextSelection()
      }
    }
  )

  onMounted(() => {
    // 添加全局样式
    if (!document.querySelector('#no-select-style')) {
      const style = document.createElement('style')
      style.id = 'no-select-style'
      style.textContent = `.no-select {
        user-select: none !important;
        -webkit-user-select: none !important;
        -moz-user-select: none !important;
        -ms-user-select: none !important;
      }`
      document.head.appendChild(style)
    }

    const div = ContextMenuRef.value
    //这里只监听了div的右键，如果需要监听其他元素的右键，需要在其他元素上监听
    div.addEventListener('contextmenu', handleContextMenu)
    // 这里需要监听window的右键，否则右键会触发div的右键事件，导致menu无法关闭，并且阻止默认右键菜单
    window.addEventListener(
      'contextmenu',
      (e) => {
        e.preventDefault()
        e.stopPropagation()
      },
      false
    )
    window.addEventListener('click', closeMenu, true)
    window.addEventListener('contextmenu', closeMenu, true)
  })

  onUnmounted(() => {
    const div = ContextMenuRef.value
    div?.removeEventListener('contextmenu', handleContextMenu)
    window.removeEventListener('contextmenu', preventDefault)
    window.removeEventListener('wheel', preventDefault)
    window.removeEventListener('selectstart', preventTextSelection)
    window.removeEventListener('click', closeMenu, true)
    window.removeEventListener('contextmenu', closeMenu, true)

    // 确保恢复选择功能
    enableTextSelection()

    // 移除样式
    const style = document.querySelector('#no-select-style')
    if (style) style.remove()
  })

  return {
    showMenu,
    x,
    y,
    handleContextMenu
  }
}

// ============================================================================
// 阶段 9：上下文菜单项构建（需求文档 5.4 节）
// ============================================================================

/**
 * 菜单动作回调的统一签名
 */
export type ContextMenuAction =
  | 'enter-chat'
  | 'encrypted-chat'
  | 'voice-call'
  | 'video-call'
  | 'open-in-new-window'
  | 'set-remark'
  | 'toggle-favorite'
  | 'toggle-block'
  | 'delete-friend'
  | 'invite-members'
  | 'edit-room'
  | 'set-visibility'
  | 'leave-room'
  | 'forget-room'
  | 'edit-space'
  | 'manage-children'
  | 'leave-space'
  | 'delete-space'

/**
 * 菜单项（带分隔符支持），与 OPT.RightMenu 兼容
 *
 * - 普通项: { type: 'item', key, label, icon, primary?, danger? }
 * - 分隔符: { type: 'separator' }
 */
export type ContextMenuItem =
  | {
      type: 'item'
      key: ContextMenuAction
      label: string
      icon: string
      /** 主操作（加粗显示） */
      primary?: boolean
      /** 危险操作（红色） */
      danger?: boolean
      /** 动态显示条件 */
      visible?: boolean
    }
  | { type: 'separator' }

/** 分组辅助：在两组之间插入分隔符 */
const group = (...groups: ContextMenuItem[][]): ContextMenuItem[] => {
  const result: ContextMenuItem[] = []
  groups.forEach((grp, grpIdx) => {
    if (grpIdx > 0 && grp.length > 0) {
      result.push({ type: 'separator' })
    }
    result.push(...grp)
  })
  return result
}

/**
 * 构建好友右键菜单（需求文档 5.4 节）
 *
 * 分组结构：
 * - 组1: 进入聊天 / 加密聊天 / 语音通话 / 视频通话 / 在新窗口打开
 * - 组2: 设置备注 / 设为收藏 / 屏蔽好友
 * - 组3: 删除好友
 *
 * @param friend 好友数据
 * @returns 菜单项数组（含分隔符）
 */
export const buildFriendMenu = (friend: MatrixContact): ContextMenuItem[] => {
  const { t } = useI18n()
  const isFavorite = friend.friendStatus === 'favorite'
  const isBlocked = friend.friendStatus === 'blocked'

  return group(
    [
      { type: 'item', key: 'enter-chat', label: t('friend.context.send_message'), icon: 'message', primary: true },
      { type: 'item', key: 'encrypted-chat', label: t('friend.context.encrypted_chat'), icon: 'lock' },
      { type: 'item', key: 'voice-call', label: t('friend.context.voice_call'), icon: 'phone' },
      { type: 'item', key: 'video-call', label: t('friend.context.video_call'), icon: 'video' },
      { type: 'item', key: 'open-in-new-window', label: t('friend.context.open_in_new_window'), icon: 'expand' }
    ],
    [
      { type: 'item', key: 'set-remark', label: t('friend.context.set_remark'), icon: 'edit' },
      {
        type: 'item',
        key: 'toggle-favorite',
        label: isFavorite ? t('friend.context.unfavorite') : t('friend.context.favorite'),
        icon: isFavorite ? 'unpin' : 'pin'
      },
      {
        type: 'item',
        key: 'toggle-block',
        label: isBlocked ? t('friend.context.unblock') : t('friend.context.block'),
        icon: 'forbid'
      }
    ],
    [{ type: 'item', key: 'delete-friend', label: t('friend.context.remove'), icon: 'delete', danger: true }]
  )
}

/**
 * 构建房间右键菜单（需求文档 5.4 节）
 *
 * 分组结构：
 * - 组1: 进入聊天 / 视频通话 / 在新窗口打开
 * - 组2: 邀请成员 / 修改房间信息 / 设置可见性
 * - 组3: 离开房间 / 忘记房间
 *
 * @param room 房间会话
 * @returns 菜单项数组（含分隔符）
 */
export const buildRoomMenu = (room: RoomMenuContext): ContextMenuItem[] => {
  const { t } = useI18n()
  const isLeaved = room.membership === 'leave' || room.membership === 'ban'

  return group(
    [
      { type: 'item', key: 'enter-chat', label: t('room.context.enter_chat'), icon: 'message', primary: true },
      { type: 'item', key: 'video-call', label: t('room.context.video_call'), icon: 'video', visible: !isLeaved },
      { type: 'item', key: 'open-in-new-window', label: t('room.context.open_in_new_window'), icon: 'expand' }
    ],
    [
      {
        type: 'item',
        key: 'invite-members',
        label: t('room.context.invite_members'),
        icon: 'add-user',
        visible: !isLeaved
      },
      { type: 'item', key: 'edit-room', label: t('room.context.edit_room'), icon: 'edit', visible: !isLeaved },
      { type: 'item', key: 'set-visibility', label: t('room.context.set_visibility'), icon: 'eye', visible: !isLeaved }
    ],
    [
      { type: 'item', key: 'leave-room', label: t('room.context.leave_room'), icon: 'logout', visible: !isLeaved },
      { type: 'item', key: 'forget-room', label: t('room.context.forget_room'), icon: 'delete', danger: true }
    ]
  )
}

/**
 * 构建空间右键菜单（需求文档 5.4 节）
 *
 * 分组结构：
 * - 组1: 进入聊天 / 在新窗口打开
 * - 组2: 编辑空间 / 邀请成员 / 管理子房间
 * - 组3: 离开空间 / 删除空间
 *
 * @param space 空间数据
 * @returns 菜单项数组（含分隔符）
 */
export const buildSpaceMenu = (space: SpaceListItem): ContextMenuItem[] => {
  // space 参数保留用于未来根据空间状态（isPublic/isPinned 等）动态调整菜单项
  void space
  const { t } = useI18n()

  return group(
    [
      { type: 'item', key: 'enter-chat', label: t('space.context.enter_chat'), icon: 'message', primary: true },
      { type: 'item', key: 'open-in-new-window', label: t('space.context.open_in_new_window'), icon: 'expand' }
    ],
    [
      { type: 'item', key: 'edit-space', label: t('space.context.edit_space'), icon: 'edit' },
      { type: 'item', key: 'invite-members', label: t('space.context.invite_members'), icon: 'add-user' },
      { type: 'item', key: 'manage-children', label: t('space.context.manage_children'), icon: 'list' }
    ],
    [
      { type: 'item', key: 'leave-space', label: t('space.context.leave_space'), icon: 'logout' },
      { type: 'item', key: 'delete-space', label: t('space.context.delete_space'), icon: 'delete', danger: true }
    ]
  )
}

/**
 * 过滤菜单项中的不可见项，并保留分隔符语义
 */
export const filterVisibleItems = (items: ContextMenuItem[]): ContextMenuItem[] => {
  const filtered = items.filter((item) => item.type === 'separator' || item.visible !== false)
  // 移除开头/结尾/连续的分隔符
  const result: ContextMenuItem[] = []
  let prevWasItem = false
  for (const item of filtered) {
    if (item.type === 'separator') {
      if (prevWasItem) {
        result.push(item)
        prevWasItem = false
      }
    } else {
      result.push(item)
      prevWasItem = true
    }
  }
  // 移除末尾分隔符
  while (result.length > 0 && result[result.length - 1].type === 'separator') {
    result.pop()
  }
  return result
}

// ============================================================================
// 菜单动作处理器（需求文档 5.4 节 - 点击行为）
// ============================================================================

/** 滚动目标区域标识（用于 Details.vue 内滚动定位） */
export type ScrollTarget = 'room-name' | 'visibility'

/** 菜单动作上下文：提供执行动作所需的 ID */
export type MenuActionContext = {
  roomId?: string
  spaceId?: string
  userId?: string
}

/** createMenuActionHandler 的依赖注入选项 */
export type MenuActionHandlerOptions = {
  /** 在新窗口打开聊天（由 useIndependentChatWindow.openInNewWindow 提供） */
  openInNewWindow: (roomId: string) => Promise<unknown>
  /** 路由跳转（由 router.push 提供） */
  navigate: (path: string) => Promise<unknown>
  /** 滚动到指定区域（由组件 emit 提供） */
  emitScroll: (target: ScrollTarget) => void
}

/**
 * 创建菜单动作处理器
 *
 * 使用依赖注入模式，便于单元测试和在 Vue 组件外使用。
 *
 * 行为定义：
 * - open-in-new-window: 调用 openInNewWindow(roomId)
 * - edit-room: navigate('/room/{roomId}') + emitScroll('room-name')
 * - set-visibility: navigate('/room/{roomId}') + emitScroll('visibility')
 * - manage-children: navigate('/space/{spaceId}')
 *
 * @param options 依赖注入选项
 * @returns 动作处理函数
 */
export const createMenuActionHandler =
  (options: MenuActionHandlerOptions) =>
  async (action: ContextMenuAction, context: MenuActionContext): Promise<void> => {
    switch (action) {
      case 'open-in-new-window': {
        if (context.roomId) {
          await options.openInNewWindow(context.roomId)
        }
        break
      }
      case 'edit-room': {
        if (context.roomId) {
          await options.navigate(`/room/${context.roomId}`)
          options.emitScroll('room-name')
        }
        break
      }
      case 'set-visibility': {
        if (context.roomId) {
          await options.navigate(`/room/${context.roomId}`)
          options.emitScroll('visibility')
        }
        break
      }
      case 'manage-children': {
        if (context.spaceId) {
          await options.navigate(`/space/${context.spaceId}`)
        }
        break
      }
      default:
        // 其他动作由调用方自行处理（enter-chat、delete-friend 等）
        break
    }
  }
