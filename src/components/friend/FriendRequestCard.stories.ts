import type { Meta, StoryObj } from '@storybook/vue3-vite'
import FriendRequestCard from './FriendRequestCard.vue'

const baseRequest = {
  userId: '@alice:example.com',
  displayName: 'Alice',
  avatarUrl: '',
  message: '想和你一起协作 UX-03 的通讯录体验',
  timestamp: Date.now(),
  direction: 'incoming' as const,
  applyId: 'req-1'
}

const meta = {
  title: 'Components/Friend/FriendRequestCard',
  component: FriendRequestCard,
  parameters: {
    layout: 'centered'
  },
  args: {
    request: baseRequest
  }
} satisfies Meta<typeof FriendRequestCard>

export default meta
type Story = StoryObj<typeof meta>

export const Incoming: Story = {}

export const Outgoing: Story = {
  args: {
    request: {
      ...baseRequest,
      direction: 'outgoing'
    }
  }
}

export const Expired: Story = {
  args: {
    request: {
      ...baseRequest,
      timestamp: Date.now() - 8 * 24 * 60 * 60 * 1000
    }
  }
}
