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
    isPublic: false,
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
    isPublic: false,
    statusText: '需审批',
    statusTone: 'warning' as const,
    visibilityText: '私有'
  },
  {
    spaceId: '!space-public:example.com',
    name: 'Open Source Community',
    childCount: 12,
    memberCount: 128,
    isPublic: true,
    visibilityText: '公开'
  },
  {
    spaceId: '!space-archive:example.com',
    name: 'Archive',
    childCount: 1,
    memberCount: 5,
    isPublic: false,
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
    loading: false
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

export const Default: Story = {}

export const PublicSpaceSelected: Story = {
  args: {
    selectedSpaceId: '!space-public:example.com'
  }
}

export const EmptyResults: Story = {
  args: {
    spaces: [],
    selectedSpaceId: '',
    loading: false
  }
}

export const Loading: Story = {
  args: {
    loading: true
  }
}
