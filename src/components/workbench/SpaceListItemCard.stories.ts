import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { defineComponent } from 'vue'
import { createSidebarFrameStyle } from '~/.storybook/harness'
import SpaceListItemCard from './SpaceListItemCard.vue'

const storyFrameStyle = createSidebarFrameStyle(220)

const meta = {
  title: 'Components/Workbench/SpaceListItemCard',
  component: SpaceListItemCard,
  parameters: {
    layout: 'fullscreen'
  },
  args: {
    active: false,
    compact: false,
    item: {
      spaceId: '!space-design:example.com',
      name: 'Design Collaboration',
      childCount: 6,
      memberCount: 42,
      unreadCount: 5,
      topic: 'Design critiques, delivery, and review cadence',
      statusText: '重点关注',
      statusTone: 'info',
      visibilityText: '公开'
    }
  },
  render: (args) =>
    defineComponent({
      components: { SpaceListItemCard },
      setup() {
        return {
          args,
          storyFrameStyle
        }
      },
      template: `
        <div :style="storyFrameStyle">
          <div style="padding: 8px;">
            <SpaceListItemCard v-bind="args" />
          </div>
        </div>
      `
    })
} satisfies Meta<typeof SpaceListItemCard>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const InviteOnly: Story = {
  args: {
    item: {
      spaceId: '!space-invite:example.com',
      name: 'Partner Launch',
      childCount: 3,
      memberCount: 18,
      unreadCount: 0,
      topic: 'Restricted collaboration lane',
      statusText: '邀请制',
      statusTone: 'warning',
      visibilityText: '受限'
    }
  }
}

export const ActiveCompact: Story = {
  args: {
    active: true,
    compact: true
  }
}
