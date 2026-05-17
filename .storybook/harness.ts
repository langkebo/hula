import { configurePopoverMock, resetPopoverMock } from './mocks/popover'
import { configureWebviewWindowMock, resetWebviewWindowMock } from './mocks/tauri-webview-window'
import { configureContactServiceMock, resetContactServiceMock } from './mocks/contact-service'
import { configureChatMainMock, resetChatMainMock } from './mocks/chat-main'
import { configureUserStatusStoreMock, resetUserStatusStoreMock } from './mocks/user-status-store'
import { configureGlobalStoreMock, resetGlobalStoreMock } from './mocks/global-store'
import {
  configureMatrixCapabilityServiceMock,
  resetMatrixCapabilityServiceMock
} from './mocks/matrix-capability-service'
import type { MockAnnouncement } from './mocks/announcement-store'
import {
  configureAnnouncementStoreMock,
  resetAnnouncementStoreMock,
} from './mocks/announcement-store'
import type { GroupDetail, GroupMember } from './mocks/group-store'
import { configureGroupStoreMock, resetGroupStoreMock } from './mocks/group-store'
import type { MockSpaceRoom } from './mocks/space-rooms'
import { configureSpaceRoomsMock, resetSpaceRoomsMock } from './mocks/space-rooms'

export const createSidebarFrameStyle = (minHeight: number) => `
  width: 360px;
  min-height: ${minHeight}px;
  border-radius: 16px;
  overflow: hidden;
  border: 1px solid var(--hula-border-default);
  background: var(--hula-surface-panel);
`

export const resetStorybookMocks = () => {
  resetGroupStoreMock()
  resetAnnouncementStoreMock()
  resetSpaceRoomsMock()
  resetGlobalStoreMock()
  resetUserStatusStoreMock()
  resetChatMainMock()
  resetContactServiceMock()
  resetMatrixCapabilityServiceMock()
  resetWebviewWindowMock()
  resetPopoverMock()
}

export const configureChatSidebarMocks = (options: {
  detail?: GroupDetail
  members?: GroupMember[]
  announcements?: MockAnnouncement[]
}) => {
  configureGroupStoreMock({
    detail: options.detail,
    members: options.members,
  })
  configureAnnouncementStoreMock({
    announcementContent: options.announcements?.[0]?.content ?? '',
    announList: options.announcements ?? [],
    announError: false,
    isAddAnnoun: true,
  })
  configureGlobalStoreMock({ isSidebarExpand: true })
  configureUserStatusStoreMock({ userStatus: 'online' })
  configureChatMainMock({})
  configureContactServiceMock({})
  configureWebviewWindowMock({})
  configurePopoverMock({})
}

export const configureRoomDetailMocks = (options: {
  detail: GroupDetail
  members: GroupMember[]
}) => {
  configureGroupStoreMock({
    detail: options.detail,
    members: options.members
  })
}

export { configureMatrixCapabilityServiceMock }

export const configureWorkbenchMocks = (options: {
  detail: GroupDetail
  members: GroupMember[]
  announcements: MockAnnouncement[]
  spaceRooms: MockSpaceRoom[]
}) => {
  configureGroupStoreMock({
    detail: options.detail,
    members: options.members
  })
  configureAnnouncementStoreMock({
    announcementContent: options.announcements[0]?.content ?? '',
    announList: options.announcements,
    announError: false,
    isAddAnnoun: true
  })
  configureSpaceRoomsMock({
    rooms: options.spaceRooms
  })
}
