import type { Meta, StoryObj } from '@storybook/vue3'
import BurnIndicator from './BurnIndicator.vue'

const meta: Meta<typeof BurnIndicator> = {
  title: 'Burn/BurnIndicator',
  component: BurnIndicator,
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
  argTypes: {
    status: { control: 'select', options: ['waiting', 'burning', 'burned'] },
    remainingSeconds: { control: 'number' },
    totalSeconds: { control: 'number' }
  }
}

export default meta
type Story = StoryObj<typeof BurnIndicator>

export const Waiting: Story = {
  args: {
    status: 'waiting',
    remainingSeconds: 60,
    totalSeconds: 60
  }
}

export const Burning: Story = {
  args: {
    status: 'burning',
    remainingSeconds: 35,
    totalSeconds: 60
  }
}

export const AlmostExpired: Story = {
  args: {
    status: 'burning',
    remainingSeconds: 5,
    totalSeconds: 60
  }
}

export const Burned: Story = {
  args: {
    status: 'burned',
    remainingSeconds: 0,
    totalSeconds: 60
  }
}
