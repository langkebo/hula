import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { OnlineEnum } from '@/enums'
import FriendListItem from './FriendListItem.vue'

const meta = {
  title: 'Components/Friend/FriendListItem',
  component: FriendListItem,
  parameters: {
    layout: 'centered'
  },
  args: {
    item: {
      userId: '@alice:example.com',
      displayName: 'Alice',
      avatarUrl: '',
      uid: '@alice:example.com',
      name: 'Alice',
      account: 'alice',
      avatar: '',
      activeStatus: OnlineEnum.ONLINE,
      remark: '产品 Alice',
      lastOptTime: Date.now(),
      hideMyPosts: false,
      hideTheirPosts: false,
      friendStatus: 'favorite',
      statusMessage: 'Design review ready'
    },
    selected: false,
    query: ''
  }
} satisfies Meta<typeof FriendListItem>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Highlighted: Story = {
  args: {
    query: 'Alice'
  }
}

export const Rtl: Story = {
  args: {
    dir: 'rtl'
  }
}
