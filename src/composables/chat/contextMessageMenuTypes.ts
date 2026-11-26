import type { useI18n } from 'vue-i18n'
import type { useChatCopy } from '@/composables/chat/useChatCopy'
import type { useChatFileDownload } from '@/composables/chat/useChatFileDownload'
import type { useGroupRoleGuard } from '@/composables/chat/useGroupRoleGuard'
import type { useActionFeedback } from '@/composables/common/useActionFeedback'
import type { useDownload } from '@/composables/common/useDownload'
import type { useChatStore } from '@/stores/domains/chat/chat'
import type { useEmojiStore } from '@/stores/domains/chat/emoji'
import type { useSettingStore } from '@/stores/domains/settings/setting'
import type { useUserStore } from '@/stores/domains/user/user'
import type { useGlobalStore } from '@/stores/domains/widget/global'
import type { ContextMenuHelpers } from './contextMenuHelpers'

/** 消息菜单列表依赖（通用 / 消息 / 历史模式） */
export type MessageMenuDeps = {
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
  helpers: ContextMenuHelpers
  chatStore: ReturnType<typeof useChatStore>
  emojiStore: ReturnType<typeof useEmojiStore>
  userStore: ReturnType<typeof useUserStore>
  globalStore: ReturnType<typeof useGlobalStore>
  settingStore: ReturnType<typeof useSettingStore>
  groupRoleGuard: ReturnType<typeof useGroupRoleGuard>
}
