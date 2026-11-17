import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { defineComponent } from 'vue'
import SpaceRoomGrid from './SpaceRoomGrid.vue'

/**
 * 空间子房间列表（§17 列表容器），覆盖列表 / 骨架 / 空态 / 搜索无匹配四态。
 *
 * 空态插图由组件内部的 `EmptyState` 提供，故事只负责驱动 `rooms` /
 * `loading` / `searchQuery` 三个入口。
 */
const frameStyle = 'width: 420px; padding: 12px;'

const meta = {
  title: 'Components/Space/SpaceRoomGrid',
  component: SpaceRoomGrid,
  parameters: {
    layout: 'centered'
  },
  args: {
    rooms: [
      {
        roomId: '!room-general:example.com',
        name: 'General',
        memberCount: 128,
        onlineCount: 18,
        joined: true
      },
      {
        roomId: '!room-design:example.com',
        name: 'Design Review',
        memberCount: 36,
        onlineCount: 4,
        joined: true,
        suggested: true
      },
      {
        roomId: '!room-invite:example.com',
        name: 'Partner Launch',
        memberCount: 12,
        onlineCount: 0,
        joined: false
      }
    ],
    loading: false,
    canManage: true,
    searchQuery: ''
  },
  render: (args) =>
    defineComponent({
      components: { SpaceRoomGrid },
      setup() {
        return {
          args,
          frameStyle
        }
      },
      template: `
        <div :style="frameStyle">
          <SpaceRoomGrid v-bind="args" />
        </div>
      `
    })
} satisfies Meta<typeof SpaceRoomGrid>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Loading: Story = {
  args: {
    rooms: [],
    loading: true
  }
}

export const Empty: Story = {
  args: {
    rooms: [],
    loading: false,
    searchQuery: ''
  }
}

export const NoMatch: Story = {
  args: {
    rooms: [],
    loading: false,
    searchQuery: 'release'
  }
}
