import { fileURLToPath, URL } from 'node:url'

const resolveFromStorybook = (relativePath: string) => fileURLToPath(new URL(relativePath, import.meta.url))

export const storybookMockAliases = {
  '@/stores/domains/chat/contacts': resolveFromStorybook('./mocks/contact-store.ts'),
  '@/stores/domains/chat/group': resolveFromStorybook('./mocks/group-store.ts'),
  '@/stores/domains/chat/announcement': resolveFromStorybook('./mocks/announcement-store.ts'),
  '@/stores/domains/widget/global': resolveFromStorybook('./mocks/global-store.ts'),
  '@/stores/domains/user/userStatus': resolveFromStorybook('./mocks/user-status-store.ts'),
  '@/composables/space/useSpaceRooms': resolveFromStorybook('./mocks/space-rooms.ts'),
  '@/hooks/useChatMain': resolveFromStorybook('./mocks/chat-main.ts'),
  '@/hooks/useChatMain.ts': resolveFromStorybook('./mocks/chat-main.ts'),
  '@/hooks/usePopover': resolveFromStorybook('./mocks/popover.ts'),
  '@/hooks/usePopover.ts': resolveFromStorybook('./mocks/popover.ts'),
  '@/hooks/session/openMsgSession': resolveFromStorybook('./mocks/open-msg-session.ts'),
  '@/services/matrix/user/MatrixContactService': resolveFromStorybook('./mocks/contact-service.ts'),
  '@/services/matrix/MatrixCapabilityService': resolveFromStorybook('./mocks/matrix-capability-service.ts'),
  '@/services/matrix/friends/MatrixFriendService': resolveFromStorybook('./mocks/matrix-friend-service.ts'),
  '@/services/matrix/friends/MatrixSpecialFriendService': resolveFromStorybook('./mocks/matrix-special-friend-service.ts'),
  '@/components/common/InfoPopover.vue': resolveFromStorybook('./mocks/info-popover.ts'),
  '@/components/common/ContextMenu.vue': resolveFromStorybook('./mocks/context-menu.ts'),
  '@/components/room/MemberList.vue': resolveFromStorybook('./mocks/member-list.ts'),
  '@tauri-apps/api/core': resolveFromStorybook('./mocks/tauri-core.ts'),
  '@tauri-apps/api/webviewWindow': resolveFromStorybook('./mocks/tauri-webview-window.ts'),
  '@tauri-apps/api/window': resolveFromStorybook('./mocks/tauri-webview-window.ts'),
  'dayjs/': resolveFromStorybook('../node_modules/dayjs/esm/'),
  'events': resolveFromStorybook('./mocks/events.ts'),
  'loglevel': resolveFromStorybook('./mocks/loglevel.ts'),
  'content-type': resolveFromStorybook('./mocks/content-type.js'),
  'sdp-transform': resolveFromStorybook('./mocks/sdp-transform.js'),
  'matrix-events-sdk': resolveFromStorybook('./mocks/matrix-events-sdk.js'),
  'matrix-widget-api': resolveFromStorybook('./mocks/matrix-widget-api.js')
} as const
