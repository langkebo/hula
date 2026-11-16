import type { useI18n } from 'vue-i18n'
import type { useChatCopy } from '@/composables/chat/useChatCopy'
import type { useChatFileDownload } from '@/composables/chat/useChatFileDownload'
import type { useGroupRoleGuard } from '@/composables/chat/useGroupRoleGuard'
import type { useActionFeedback } from '@/composables/common/useActionFeedback'
import type { useDownload } from '@/composables/common/useDownload'
import { MsgEnum } from '@/enums'
import type { MessageType, useChatStore } from '@/stores/domains/chat/chat'
import type { useEmojiStore } from '@/stores/domains/chat/emoji'
import type { useGroupStore } from '@/stores/domains/chat/group'
import type { useSettingStore } from '@/stores/domains/settings/setting'
import type { useUserStore } from '@/stores/domains/user/user'
import type { useGlobalStore } from '@/stores/domains/widget/global'
import { createMediaMenus } from './contextMediaMenus'
import { createMemberMenus } from './contextMemberMenus'
import type { ContextMenuHelpers } from './contextMenuHelpers'
import { createMessageMenus } from './contextMessageMenus'

export { deleteLocalMessage, isLocalOrFailedMessage } from './contextMessageLocalActions'

/** 菜单列表工厂依赖 */
export type ContextMenuListDeps = {
  t: ReturnType<typeof useI18n>['t']
  showFeedback: ReturnType<typeof useActionFeedback>['showFeedback']
  /** 平台事实（`usePlatform.isDesktop()` 取一次）：桌面专属项在构建期就不输出，移动端不渲染 */
  isDesktop: boolean
  /** 历史记录模式：specialMenuList 输出复制/转发/另存为，正常模式只输出删除 */
  isHistoryMode: boolean
  /** 历史模式下禁用选择/转发动作（多窗口场景） */
  disableHistoryActions: boolean
  downloadFile: ReturnType<typeof useDownload>['downloadFile']
  fileDownload: ReturnType<typeof useChatFileDownload>
  handleCopy: ReturnType<typeof useChatCopy>['handleCopy']
  /** 打开删除确认弹窗（由 useMsgDeleteConfirm 提供，正常模式 specialMenuList 的唯一动作） */
  openDeleteConfirm: (item: MessageType) => void
  helpers: ContextMenuHelpers
  chatStore: ReturnType<typeof useChatStore>
  emojiStore: ReturnType<typeof useEmojiStore>
  userStore: ReturnType<typeof useUserStore>
  globalStore: ReturnType<typeof useGlobalStore>
  groupStore: ReturnType<typeof useGroupStore>
  settingStore: ReturnType<typeof useSettingStore>
  groupRoleGuard: ReturnType<typeof useGroupRoleGuard>
}

/**
 * 右键菜单列表工厂
 *
 * 从 useChatContextMenus 抽离的菜单列表构建逻辑，按用途拆为三个子模块后在此装配：
 * - `contextMessageMenus`：通用菜单、消息菜单、历史模式菜单
 * - `contextMediaMenus`：视频 / 文件 / 图片菜单（复用通用菜单项）
 * - `contextMemberMenus`：群成员管理菜单（optionsList / report）
 * 群角色权限判断统一走 useGroupRoleGuard，所有 store 与辅助函数通过 deps 注入。
 */
export const createContextMenuLists = (deps: ContextMenuListDeps) => {
  const {
    t,
    showFeedback,
    isDesktop,
    downloadFile,
    fileDownload,
    handleCopy,
    helpers,
    globalStore,
    groupStore,
    groupRoleGuard
  } = deps

  const { commonMenuList, menuList, specialMenuList } = createMessageMenus(deps)
  const { videoMenuList, fileMenuList, imageMenuList } = createMediaMenus(
    { t, showFeedback, isDesktop, downloadFile, fileDownload, handleCopy },
    commonMenuList
  )
  const { optionsList, report } = createMemberMenus({
    t,
    showFeedback,
    helpers,
    globalStore,
    groupStore,
    groupRoleGuard
  })

  /**
   * 根据消息类型获取右键菜单列表
   * @param type 消息类型
   */
  const handleItemType = (type: MsgEnum) => {
    return type === MsgEnum.IMAGE || type === MsgEnum.EMOJI
      ? imageMenuList.value
      : type === MsgEnum.FILE
        ? fileMenuList.value
        : type === MsgEnum.VIDEO
          ? videoMenuList.value
          : menuList.value
  }

  return {
    commonMenuList,
    videoMenuList,
    menuList,
    specialMenuList,
    fileMenuList,
    imageMenuList,
    optionsList,
    report,
    handleItemType
  }
}
