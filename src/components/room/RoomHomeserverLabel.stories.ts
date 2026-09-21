import type { Meta, StoryObj } from '@storybook/vue3'
import RoomHomeserverLabel from './RoomHomeserverLabel.vue'

const meta = {
  title: 'Room/RoomHomeserverLabel',
  component: RoomHomeserverLabel,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          '房间 homeserver 域名 chip（方案 §2.1）：标注房间所在服务器。' +
          '`roomId` 形如 `!opaque:server`，取 server 段统一走 `@/utils/userIdentity` 的 ' +
          '`extractServerName`，组件内禁止自行 split / indexOf。'
      }
    }
  },
  argTypes: {
    roomId: { control: 'text', description: '房间 ID（!opaque:server）；serverName 为空时生效' },
    serverName: { control: 'text', description: '直接传入 server name（优先级高于 roomId）' }
  },
  args: {
    roomId: '!tjg-official:matrix.test',
    serverName: ''
  }
} satisfies Meta<typeof RoomHomeserverLabel>

export default meta
type Story = StoryObj<typeof meta>

export const FromRoomId: Story = {
  args: {
    roomId: '!tjg-official:matrix.test'
  }
}

/** 联邦房间：域名直接可见，无需打开房间详情 */
export const FederatedRoom: Story = {
  args: {
    roomId: '!abc123def:remote.example'
  }
}

/** 直接给域名：已持有 server name 时避免重复解析 */
export const ServerNameDirect: Story = {
  args: {
    roomId: '',
    serverName: 'chat.example.org'
  }
}

/** 空输入：不渲染任何文本（调用方需自行 v-if，避免留下空 chip） */
export const Empty: Story = {
  args: {
    roomId: '',
    serverName: ''
  }
}

export const AllDark: Story = {
  parameters: {
    theme: 'dark'
  },
  args: {
    roomId: '!abc123def:remote.example'
  }
}
