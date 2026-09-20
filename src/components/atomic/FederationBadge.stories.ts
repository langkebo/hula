import type { Meta, StoryObj } from '@storybook/vue3'
import FederationBadge from './FederationBadge.vue'

const meta = {
  title: 'Atomic/FederationBadge',
  component: FederationBadge,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Matrix 联邦身份徽章组件，用于标识房间或用户是否来自联邦（远端服务器）。支持三态尺寸（xs/sm/md），颜色区分本地/远端。'
      }
    }
  },
  argTypes: {
    size: {
      control: 'radio',
      options: ['xs', 'sm', 'md'],
      description: '徽章尺寸'
    },
    isLocal: {
      control: 'boolean',
      description: '是否为本地服务器'
    },
    showIcon: {
      control: 'boolean',
      description: '是否显示图标'
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
    size: 'sm',
    isLocal: false,
    showIcon: true,
    showLabel: true,
    label: undefined,
    title: '来自远端服务器'
  }
} satisfies Meta<typeof FederationBadge>

export default meta
type Story = StoryObj<typeof meta>

export const RemoteServer: Story = {
  args: {
    isLocal: false,
    label: '跨域',
    size: 'sm'
  }
}

export const LocalServer: Story = {
  args: {
    isLocal: true,
    label: '本地',
    size: 'sm'
  }
}

export const SizeXs: Story = {
  args: {
    isLocal: false,
    size: 'xs'
  }
}

export const SizeMd: Story = {
  args: {
    isLocal: false,
    size: 'md'
  }
}

export const IconOnly: Story = {
  args: {
    isLocal: false,
    showLabel: false,
    size: 'sm'
  }
}

export const LabelOnly: Story = {
  args: {
    isLocal: false,
    showIcon: false,
    size: 'sm'
  }
}

export const AllDark: Story = {
  parameters: {
    theme: 'dark'
  },
  args: {
    isLocal: false,
    size: 'sm'
  }
}
