import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { defineComponent, ref } from 'vue'
import { createSidebarFrameStyle } from '~/.storybook/harness'
import SpaceListPane from './SpaceListPane.vue'

const storyFrameStyle = createSidebarFrameStyle(640)

const baseSpaces = [
  {
    spaceId: '!space-design:example.com',
    name: 'Design Collaboration',
    childCount: 6,
    memberCount: 42,
    unreadCount: 8,
    isPinned: true,
    statusText: '重点关注',
    statusTone: 'info' as const,
    visibilityText: '公开'
  },
  {
    spaceId: '!space-private:example.com',
    name: 'Leadership',
    childCount: 2,
    memberCount: 12,
    topic: 'Private coordination',
    statusText: '需审批',
    statusTone: 'warning' as const,
    visibilityText: '私有'
  },
  {
    spaceId: '!space-invite:example.com',
    name: 'Partner Launch',
    childCount: 3,
    memberCount: 18,
    statusText: '邀请制',
    statusTone: 'neutral' as const,
    visibilityText: '受限'
  },
  {
    spaceId: '!space-archive:example.com',
    name: 'Archive',
    childCount: 1,
    memberCount: 5,
    isLowPriority: true,
    visibilityText: '只读'
  }
]

const meta = {
  title: 'Components/Workbench/SpaceListPane',
  component: SpaceListPane,
  parameters: {
    layout: 'fullscreen'
  },
  args: {
    spaces: baseSpaces,
    selectedSpaceId: '!space-design:example.com',
    loading: false,
    totalCount: 28,
    compact: false,
    narrow: false
  },
  render: (args) =>
    defineComponent({
      components: { SpaceListPane },
      setup() {
        const selectedSpaceId = ref(args.selectedSpaceId)
        return {
          args,
          selectedSpaceId,
          storyFrameStyle
        }
      },
      template: `
        <div :style="storyFrameStyle">
          <SpaceListPane
            v-bind="args"
            :selected-space-id="selectedSpaceId"
            @select-space="selectedSpaceId = $event" />
        </div>
      `
    })
} satisfies Meta<typeof SpaceListPane>

export default meta
type Story = StoryObj<typeof meta>

export const PinnedSpaces: Story = {}

export const PublicInviteOnly: Story = {
  args: {
    selectedSpaceId: '!space-invite:example.com'
  }
}

export const EmptyResults: Story = {
  args: {
    spaces: [],
    selectedSpaceId: '',
    totalCount: 0
  }
}

export const RailMode: Story = {
  args: {
    narrow: true,
    selectedSpaceId: '!space-private:example.com'
  }
}
