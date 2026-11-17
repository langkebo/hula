import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { defineComponent } from 'vue'
import RoomCardItem from './RoomCardItem.vue'

/** 房间列表面板卡片（§17 列表容器），覆盖未读数、置顶与联邦标记三种状态。 */
const frameStyle = 'width: 320px; padding: 8px;'

const meta = {
  title: 'Components/Room/RoomCardItem',
  component: RoomCardItem,
  parameters: {
    layout: 'centered'
  },
  args: {
    item: {
      roomId: '!room-core:example.com',
      name: 'Core Team',
      topic: 'Daily sync and release coordination',
      memberCount: 24,
      onlineCount: 6,
      unreadCount: 0
    }
  },
  render: (args) =>
    defineComponent({
      components: { RoomCardItem },
      setup() {
        return {
          args,
          frameStyle
        }
      },
      template: `
        <div :style="frameStyle">
          <RoomCardItem v-bind="args" />
        </div>
      `
    })
} satisfies Meta<typeof RoomCardItem>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const UnreadPinned: Story = {
  args: {
    item: {
      roomId: '!room-release:example.com',
      name: 'Release Train',
      topic: 'Cut 2.4, verify mobile bundle, then announce',
      memberCount: 87,
      onlineCount: 12,
      unreadCount: 9,
      isPinned: true,
      isEncrypted: true
    }
  }
}

export const Federated: Story = {
  args: {
    item: {
      roomId: '!room-bridge:remote.example',
      name: 'Bridge Room',
      memberCount: 310,
      onlineCount: 0,
      unreadCount: 0,
      isFederated: true
    }
  }
}
