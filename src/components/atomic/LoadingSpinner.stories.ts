import type { Meta, StoryObj } from '@storybook/vue3'
import LoadingSpinner from './LoadingSpinner.vue'

const meta: Meta<typeof LoadingSpinner> = {
  title: 'Atomic/LoadingSpinner',
  component: LoadingSpinner,
  tags: ['autodocs'],
  argTypes: {
    percentage: { control: { type: 'range', min: 0, max: 100 } },
    loadingText: { control: 'text' }
  }
}

export default meta
type Story = StoryObj<typeof LoadingSpinner>

export const Default: Story = {
  args: {
    percentage: 30,
    loadingText: 'Loading resources...'
  }
}

export const AlmostDone: Story = {
  args: {
    percentage: 90,
    loadingText: 'Almost there...'
  }
}

export const Complete: Story = {
  args: {
    percentage: 100,
    loadingText: 'Ready!'
  }
}
