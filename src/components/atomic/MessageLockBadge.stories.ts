import type { Meta, StoryObj } from '@storybook/vue3'
import MessageLockBadge from './MessageLockBadge.vue'

const meta = {
  title: 'Atomic/MessageLockBadge',
  component: MessageLockBadge,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: '消息加密信任状态徽章组件，支持三态信任模型：绿锁=已验证、灰锁=未验证、红锁=风险。'
      }
    }
  },
  argTypes: {
    trustLevel: {
      control: 'select',
      options: ['verified', 'unverified', 'risk'],
      description: '信任等级'
    },
    showLabel: {
      control: 'boolean',
      description: '是否显示文字标签'
    },
    label: {
      control: 'text',
      description: '自定义标签文本'
    },
    title: {
      control: 'text',
      description: 'hover 提示文本'
    }
  },
  args: {
    trustLevel: 'verified',
    showLabel: true,
    label: undefined,
    title: '端到端加密已验证'
  }
} satisfies Meta<typeof MessageLockBadge>

export default meta
type Story = StoryObj<typeof meta>

export const Verified: Story = {
  args: {
    trustLevel: 'verified',
    label: 'E2E 已验证',
    title: '端到端加密已验证 - 绿锁'
  }
}

export const Unverified: Story = {
  args: {
    trustLevel: 'unverified',
    label: '未验证',
    title: '端到端加密未完全验证 - 灰锁'
  }
}

export const Risk: Story = {
  args: {
    trustLevel: 'risk',
    label: '风险',
    title: '端到端加密存在安全风险 - 红锁'
  }
}

export const IconOnly: Story = {
  args: {
    trustLevel: 'verified',
    showLabel: false
  }
}

export const UnverifiedPlain: Story = {
  args: {
    // 未加密消息不会渲染徽章（调用方以 isEncryptedMessage 作显隐守卫），
    // 因此这里用组件真实支持的 unverified 表达「未验证/未加密」态。
    // 早前此处传 `'plain' as never`，三态 v-else-if 全不匹配 → 渲染出无图标的空徽章。
    trustLevel: 'unverified',
    label: '未验证',
    title: '消息未加密，或对端设备未完成验证'
  }
}

export const AllDark: Story = {
  parameters: {
    theme: 'dark'
  },
  args: {
    trustLevel: 'verified'
  }
}
