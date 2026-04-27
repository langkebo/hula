import { createPersistedState } from 'pinia-plugin-persistedstate'
import { PiniaSharedState } from 'pinia-shared-state'

export const pinia = createPinia()
pinia
  .use(
    createPersistedState({
      auto: true
    })
  )
  .use(
    PiniaSharedState({
      enable: false,
      initialize: false,
      type: 'native'
    })
  )

export { useRoomStore } from './domains/chat/room'
export { useChatStore, useSessionStore } from './domains/chat/chat'
export { useMatrixStore } from './domains/chat/matrix'
export { useUserStore } from './domains/user/user'
export { useGroupStore } from './domains/chat/group'
export { useEmojiStore } from './domains/chat/emoji'
export { useFileStore } from './domains/widget/file'
export { useFileDownloadStore } from './domains/widget/fileDownload'
export { useThumbnailCacheStore } from './domains/widget/thumbnailCache'
export { useModerationStore } from './domains/chat/moderation'
export { useContactStore } from './domains/chat/contacts'
export { useSettingsDialogStore } from './domains/settings/settingsDialog'
export { useAdminStore } from './domains/admin/admin'
export { useSpaceStore } from './domains/widget/space'
export { useUserStatusStore } from './domains/user/userStatus'
export { useAnnouncementStore } from './domains/chat/announcement'
export { useMessageStore } from './domains/chat/message'
export { useMenuTopStore } from './domains/settings/menuTop'
export { useInitialSyncStore } from './domains/chat/initialSync'
export { useBadgeStore } from './domains/chat/badge'
export { useScannerStore } from './domains/widget/scanner'
export { useQuotaStore } from './domains/admin/quota'
export { useGlobalStore } from './domains/widget/global'
export { useDownloadQuenuStore } from './domains/widget/downloadQuenu'
export { useSettingStore } from './domains/settings/setting'
export { useGuideStore } from './domains/settings/guide'
export { usePluginsStore } from './domains/settings/plugins'
export { useSpotlightStore } from './domains/widget/spotlight'
export { useNoticeStore } from './domains/chat/notice'
export { useMobileStore } from './domains/settings/mobile'
export { useBotStore } from './domains/user/bot'
export { useLoginHistoriesStore } from './domains/user/loginHistory'
export { useAlwaysOnTopStore } from './domains/settings/alwaysOnTop'
export { useImageViewer } from './domains/widget/imageViewer'
export { useUserMenuStore } from './domains/user/userMenu'
export { useVideoViewer } from './domains/widget/videoViewer'
export { useHistoryStore } from './domains/chat/history'
export { useSessionUnreadStore } from './domains/chat/sessionUnread'
