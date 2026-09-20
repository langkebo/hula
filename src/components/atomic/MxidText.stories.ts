import type { Meta, StoryObj } from '@storybook/vue3'
import MxidText from './MxidText.vue'

const meta = {
  title: 'Atomic/MxidText',
  component: MxidText,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'Matrix MXID 文本展示组件，支持自动截断 + title 悬浮显示全量。'
      }
    }
  },
  argTypes: {
    mxid: {
      control: 'text',
      description: '完整 MXID（如 @user:server.name）'
    },
    showFull: {
      control: 'boolean',
      description: '是否显示完整 MXID，否则仅显示 localpart'
    },
    isMono: {
      control: 'boolean',
      description: '是否使用等宽字体（便于比对）'
    },
    maxLength: {
      control: 'number',
      description: '最大显示长度（字符数），超出则截断'
    }
  },
  args: {
    mxid: '@alice:matrix.example.com',
    showFull: false,
    isMono: false,
    maxLength: 20
  }
} satisfies Meta<typeof MxidText>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const FullMxid: Story = {
  args: {
    showFull: true,
    mxid: '@alice:matrix.example.com'
  }
}

export const LongMxid: Story = {
  args: {
    showFull: true,
    maxLength: 15,
    mxid: '@very_long_username_with_many_characters:matrix.example.com'
  }
}

export const MonoFont: Story = {
  args: {
    isMono: true,
    mxid: '@bob:homeserver.org'
  }
}

export const ShortLocalpart: Story = {
  args: {
    mxid: '@dev:localhost',
    showFull: false
  }
}

export const NullMxid: Story = {
  args: {
    mxid: null
  }
}

export const AllDark: Story = {
  parameters: {
    theme: 'dark'
  },
  args: {
    mxid: '@alice:matrix.example.com'
  }
}
