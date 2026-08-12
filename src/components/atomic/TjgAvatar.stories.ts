import type { Meta, StoryObj } from '@storybook/vue3'
import TjgAvatar from './TjgAvatar.vue'

const meta: Meta<typeof TjgAvatar> = {
  title: 'Atomic/TjgAvatar',
  component: TjgAvatar,
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
  argTypes: {
    size: { control: { type: 'range', min: 24, max: 120, step: 4 } },
    round: { control: 'boolean' },
    src: { control: 'text' },
    name: { control: 'text' }
  }
}

export default meta
type Story = StoryObj<typeof TjgAvatar>

export const Default: Story = {
  args: {
    src: 'https://api.dicebear.com/9.x/avataaars/svg?seed=test',
    size: 44,
    round: true,
    name: 'Test User'
  }
}

export const TextFallback: Story = {
  args: {
    src: '',
    size: 44,
    round: true,
    name: 'Alice Wonderland'
  }
}

export const Square: Story = {
  args: {
    src: 'https://api.dicebear.com/9.x/avataaars/svg?seed=square',
    size: 48,
    round: false,
    name: 'Square Avatar'
  }
}

export const Large: Story = {
  args: {
    src: 'https://api.dicebear.com/9.x/avataaars/svg?seed=large',
    size: 96,
    round: true,
    name: 'Large Avatar'
  }
}

export const Small: Story = {
  args: {
    src: 'https://api.dicebear.com/9.x/avataaars/svg?seed=small',
    size: 28,
    round: true,
    name: 'Small'
  }
}
