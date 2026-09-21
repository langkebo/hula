import type { Meta, StoryObj } from '@storybook/vue3'
import UserIdentity from './UserIdentity.vue'

const meta = {
  title: 'Common/UserIdentity',
  component: UserIdentity,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          '联邦身份组合展示单元（方案 §2.1）：头像 + 主标识 + 完整 MXID + 联邦 chip。' +
          'MXID 解析全部走 `@/utils/userIdentity`（extractServerName / sameHomeserver / toLocalpart），' +
          '组件内禁止自行 split。无法判定本机域名时按「本地用户」处理，避免误标联邦。'
      }
    }
  },
  argTypes: {
    displayName: { control: 'text', description: '显示名称（优先于 MXID localpart）' },
    mxid: { control: 'text', description: '完整 MXID，如 @user:server.name' },
    avatarUrl: { control: 'text', description: '头像 URL' },
    localServer: { control: 'text', description: '本机 homeserver，用于联邦判定' },
    showAvatar: { control: 'boolean', description: '是否渲染头像（false 时由外层提供头像）' },
    showFederation: { control: 'boolean', description: '是否显示联邦 chip' },
    showMxid: { control: 'boolean', description: '是否显示次级 MXID' },
    showFullMxid: { control: 'boolean', description: 'MXID 显示完整值（否则仅 localpart）' },
    mxidMaxLength: { control: 'number', description: 'MXID 最大显示长度' },
    avatarSize: { control: 'number', description: '头像尺寸（px）' },
    interactive: { control: 'boolean', description: '是否可交互（hover 高亮）' }
  },
  args: {
    displayName: 'kevins',
    mxid: '@kevins:matrix.test',
    avatarUrl: '',
    localServer: 'matrix.test',
    showAvatar: false,
    showFederation: true,
    showMxid: true,
    showFullMxid: true,
    mxidMaxLength: 30,
    avatarSize: 36,
    interactive: false
  }
} satisfies Meta<typeof UserIdentity>

export default meta
type Story = StoryObj<typeof meta>

/** 同域用户：chip 应落在「本地用户」样式 */
export const LocalUser: Story = {
  args: {
    mxid: '@kevins:matrix.test',
    localServer: 'matrix.test'
  }
}

/** 跨域用户：chip 应落在远端（联邦）样式 */
export const FederatedUser: Story = {
  args: {
    displayName: 'Bob',
    mxid: '@bob:remote.example',
    localServer: 'matrix.test'
  }
}

/** 本机域名未就绪：按本地处理，绝不误标「联邦用户」 */
export const UnknownLocalServer: Story = {
  args: {
    mxid: '@bob:remote.example',
    localServer: ''
  }
}

/** 仅显示 localpart（MXID 作为次级信息被截断为短标识） */
export const LocalpartOnly: Story = {
  args: {
    showFullMxid: false,
    mxidMaxLength: 12
  }
}

/** 带头像变体（成员面板改用外层头像时用 showAvatar=false） */
export const WithAvatar: Story = {
  args: {
    showAvatar: true,
    avatarSize: 36
  }
}

/** 无显示名：主标识回退为 MXID 的 localpart */
export const DisplayNameFallback: Story = {
  args: {
    displayName: ''
  }
}

export const AllDark: Story = {
  parameters: {
    theme: 'dark'
  },
  args: {
    mxid: '@bob:remote.example',
    localServer: 'matrix.test'
  }
}
