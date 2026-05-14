import type { Meta, StoryObj } from '@storybook/vue3'
import { RoomTypeEnum } from '@/enums'
import { ANNOUNCEMENT_MOCKS, GROUP_DETAIL_MOCKS, GROUP_MEMBER_MOCKS, SPACE_ROOM_MOCKS } from '~/.storybook/mock-data'
import { configureAnnouncementStoreMock, resetAnnouncementStoreMock } from '~/.storybook/mocks/announcement-store'
import { configureGroupStoreMock, resetGroupStoreMock } from '~/.storybook/mocks/group-store'
import { configureSpaceRoomsMock, resetSpaceRoomsMock } from '~/.storybook/mocks/space-rooms'
import WorkbenchDetailPane from './WorkbenchDetailPane.vue'

const meta: Meta<typeof WorkbenchDetailPane> = {
  title: 'Workbench/WorkbenchDetailPane',
  component: WorkbenchDetailPane,
  parameters: {
    layout: 'fullscreen'
  },
  decorators: [
    () => ({
      template: '<div style="width: 320px; height: 100vh; background: var(--hula-surface-panel);"><story /></div>'
    })
  ]
}

export default meta
type Story = StoryObj<typeof WorkbenchDetailPane>

type WorkbenchDetailPaneProps = InstanceType<typeof WorkbenchDetailPane>['$props']

const render = (args: WorkbenchDetailPaneProps) => ({
  components: { WorkbenchDetailPane },
  setup() {
    return { args }
  },
  template: '<WorkbenchDetailPane v-bind="args" />'
})

const baseSpace = {
  spaceId: '!space:example.com',
  name: 'Main Workspace',
  topic: 'Central hub for all projects and collaboration.',
  memberCount: 45,
  childCount: 12
}

const baseSession = {
  roomId: '!design:example.com',
  name: 'Design Collaboration',
  avatar: '',
  type: RoomTypeEnum.GROUP,
  unreadCount: 5,
  notificationCount: 5,
  highlightCount: 1,
  activeTime: Date.now(),
  lastMsg: "Alice: Let's review the new mockups.",
  lastMsgTime: '10:45',
  hasPermission: true
}

export const Default: Story = {
  args: {
    selectedSession: baseSession,
    activeSpace: baseSpace,
    visibleSessionCount: 12,
    totalSessionCount: 15
  },
  render,
  decorators: [
    (story) => {
      resetGroupStoreMock()
      resetAnnouncementStoreMock()
      resetSpaceRoomsMock()

      configureGroupStoreMock({
        detail: GROUP_DETAIL_MOCKS.private,
        members: GROUP_MEMBER_MOCKS
      })
      configureAnnouncementStoreMock({
        announList: ANNOUNCEMENT_MOCKS
      })
      configureSpaceRoomsMock({
        rooms: SPACE_ROOM_MOCKS
      })

      return story()
    }
  ]
}

export const NoSession: Story = {
  args: {
    ...Default.args,
    selectedSession: null
  },
  render,
  decorators: Default.decorators
}

export const NoPermission: Story = {
  args: {
    ...Default.args,
    selectedSession: {
      ...baseSession
    }
  },
  render,
  decorators: Default.decorators
}

export const DirectMessage: Story = {
  args: {
    ...Default.args,
    selectedSession: {
      ...baseSession,
      type: RoomTypeEnum.SINGLE,
      name: 'Alice'
    }
  },
  render,
  decorators: Default.decorators
}

export const ManageInvite: Story = {
  args: {
    ...Default.args,
    manageMode: 'invite',
    canManageSpace: true,
    inviteUserId: ''
  },
  render,
  decorators: Default.decorators
}

export const ManageSettings: Story = {
  args: {
    ...Default.args,
    manageMode: 'settings',
    canManageSpace: true,
    settingsName: 'Main Workspace',
    settingsTopic: 'Central hub for all projects and collaboration.'
  },
  render,
  decorators: Default.decorators
}

export const ManageAddRoom: Story = {
  args: {
    ...Default.args,
    manageMode: 'add-room',
    canManageSpace: true,
    addRoomId: '',
    addRoomSuggested: true
  },
  render,
  decorators: Default.decorators
}

export const Narrow: Story = {
  args: {
    ...Default.args,
    narrow: true
  },
  render,
  decorators: [
    () => ({
      template: '<div style="width: 240px; height: 100vh; background: var(--hula-surface-panel);"><story /></div>'
    }),
    ...(Array.isArray(Default.decorators) ? Default.decorators : [])
  ]
}

export const OverlayCreateRoom: Story = {
  args: {
    ...Default.args,
    overlayMode: 'create-room'
  },
  render
}

export const OverlayCreateSpace: Story = {
  args: {
    ...Default.args,
    overlayMode: 'create-space'
  },
  render
}

export const OverlayForward: Story = {
  args: {
    ...Default.args,
    overlayMode: 'forward',
    forwardEventId: '$event123',
    forwardRoomId: '!design:example.com'
  },
  render
}

export const OverlaySearch: Story = {
  args: {
    ...Default.args,
    overlayMode: 'search'
  },
  render
}

export const OverlayHistory: Story = {
  args: {
    ...Default.args,
    overlayMode: 'history',
    historyRoomId: '!design:example.com'
  },
  render
}

export const OverlayMergedMsg: Story = {
  args: {
    ...Default.args,
    overlayMode: 'merged-msg',
    mergedMsgIds: ['$msg1', '$msg2', '$msg3']
  },
  render
}
