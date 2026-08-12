import { useI18n } from 'vue-i18n'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import type { useDownload } from '@/composables/common/useDownload'
import { type MessageType, useChatStore } from '@/stores/domains/chat/chat'
import { useContactStore } from '@/stores/domains/chat/contacts'
import { useEmojiStore } from '@/stores/domains/chat/emoji'
import { useGroupStore } from '@/stores/domains/chat/group'
import { useSettingStore } from '@/stores/domains/settings/setting'
import { useUserStore } from '@/stores/domains/user/user'
import { useGlobalStore } from '@/stores/domains/widget/global'
import { createContextMenuHelpers } from './contextMenuHelpers'
import { createContextMenuLists } from './contextMenuLists'
import type { useChatCopy } from './useChatCopy'
import type { useChatFileDownload } from './useChatFileDownload'
import { useGroupRoleGuard } from './useGroupRoleGuard'

/** 右键菜单项的公共形状（消息项或群成员项） */
export type { ContextMenuItem } from './contextMenuLists'

type UseChatContextMenusOptions = {
  /** 历史记录模式：specialMenuList 输出复制/转发/另存为，正常模式只输出删除 */
  isHistoryMode: boolean
  /** 历史模式下禁用选择/转发动作（多窗口场景） */
  disableHistoryActions: boolean
  downloadFile: ReturnType<typeof useDownload>['downloadFile']
  fileDownload: ReturnType<typeof useChatFileDownload>
  handleCopy: ReturnType<typeof useChatCopy>['handleCopy']
  /** 打开删除确认弹窗（由 useMsgDeleteConfirm 提供，正常模式 specialMenuList 的唯一动作） */
  openDeleteConfirm: (item: MessageType) => void
}

/**
 * 聊天右键菜单工厂
 *
 * 从 useChatMain 抽离（原文件 69% 的篇幅）：消息菜单（通用/视频/文件/图片/文本）、
 * 历史模式菜单、群成员管理菜单（optionsList/report）。
 * 群角色权限判断统一走 useGroupRoleGuard，不再各自重复实现。
 *
 * 实现已拆分为两个子模块：
 * - contextMenuHelpers：纯辅助函数（好友关系、转发、复制判断等）
 * - contextMenuLists：菜单列表构建逻辑（各类右键菜单）
 *
 * 本文件仅负责组装依赖并转发工厂结果，导出 API 与拆分前完全一致。
 */
export const useChatContextMenus = (options: UseChatContextMenusOptions) => {
  const { isHistoryMode, disableHistoryActions, downloadFile, fileDownload, handleCopy, openDeleteConfirm } = options

  const { t } = useI18n()
  const { showFeedback } = useActionFeedback()
  const chatStore = useChatStore()
  const contactStore = useContactStore()
  const emojiStore = useEmojiStore()
  const userStore = useUserStore()
  const globalStore = useGlobalStore()
  const groupStore = useGroupStore()
  const settingStore = useSettingStore()
  const groupRoleGuard = useGroupRoleGuard()

  const helpers = createContextMenuHelpers({
    t,
    showFeedback,
    chatStore,
    contactStore,
    userStore
  })

  const lists = createContextMenuLists({
    t,
    showFeedback,
    isHistoryMode,
    disableHistoryActions,
    downloadFile,
    fileDownload,
    handleCopy,
    openDeleteConfirm,
    helpers,
    chatStore,
    emojiStore,
    userStore,
    globalStore,
    groupStore,
    settingStore,
    groupRoleGuard
  })

  return {
    commonMenuList: lists.commonMenuList,
    videoMenuList: lists.videoMenuList,
    specialMenuList: lists.specialMenuList,
    optionsList: lists.optionsList,
    report: lists.report,
    handleItemType: lists.handleItemType
  }
}
