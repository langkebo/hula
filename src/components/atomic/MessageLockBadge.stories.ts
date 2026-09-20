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

export const PlainMessage: Story = {
  args: {
    trustLevel: 'plain' as never,
    label: '未加密',
    title: '消息未加密'
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
