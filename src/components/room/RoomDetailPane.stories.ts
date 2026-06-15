import type { Meta, StoryObj } from '@storybook/vue3'
import { GROUP_DETAIL_MOCKS, GROUP_MEMBER_MOCKS } from '~/.storybook/mock-data'
import { configureGroupStoreMock, resetGroupStoreMock } from '~/.storybook/mocks/group-store'
import RoomDetailPane from './RoomDetailPane.vue'

const meta: Meta<typeof RoomDetailPane> = {
  title: 'Room/RoomDetailPane',
  component: RoomDetailPane,
  parameters: {
    layout: 'fullscreen'
  },
  decorators: [
    () => ({
      template:
        '<div style="width: 320px; height: 100vh; border-right: 1px solid var(--hula-border-default);"><story /></div>'
    })
  ]
}

export default meta
type Story = StoryObj<typeof RoomDetailPane>

type RoomDetailPaneProps = InstanceType<typeof RoomDetailPane>['$props']

const render = (args: RoomDetailPaneProps) => ({
  components: { RoomDetailPane },
  setup() {
    return { args }
  },
  template: '<RoomDetailPane v-bind="args" />'
})

export const Default: Story = {
  args: {
    roomId: '!design:example.com',
    roomName: 'Design Collaboration'
  },
  render,
  decorators: [
    // biome-ignore lint/suspicious/noExplicitAny: Storybook decorator signature
    (story: any) => {
      resetGroupStoreMock()
      configureGroupStoreMock({
        detail: GROUP_DETAIL_MOCKS.private,
        members: GROUP_MEMBER_MOCKS
      })
      return story()
    }
  ]
}

export const Empty: Story = {
  args: {
    roomId: null
  },
  render
}

export const Loading: Story = {
  args: {
    roomId: '!design:example.com'
  },
  render,
  decorators: [
    // biome-ignore lint/suspicious/noExplicitAny: Storybook decorator signature
    (story: any) => {
      resetGroupStoreMock()
      // Don't configure mock, buildRoomDetail will be slow or we could mock loading state if needed
      // But the component manages its own loading ref based on the async buildRoomDetail
      return story()
    }
  ]
}

export const InviteMode: Story = {
  args: {
    ...Default.args,
    inviteMode: true,
    inviteUserId: ''
  },
  render,
  decorators: Default.decorators
}

export const SettingsMode: Story = {
  args: {
    ...Default.args,
    settingsMode: true,
    settingsName: 'Design Collaboration',
    settingsTopic: 'Sync designs, announcements, and member collaboration.'
  },
  render,
  decorators: Default.decorators
}

export const LongAnnouncement: Story = {
  args: {
    ...Default.args
  },
  render,
  decorators: [
    // biome-ignore lint/suspicious/noExplicitAny: Storybook decorator signature
    (story: any) => {
      resetGroupStoreMock()
      configureGroupStoreMock({
        detail: {
          ...GROUP_DETAIL_MOCKS.private,
          topic: 'This is a very long announcement to test how it wraps and displays in the detail pane. '.repeat(10)
        },
        members: GROUP_MEMBER_MOCKS
      })
      return story()
    }
  ]
}
