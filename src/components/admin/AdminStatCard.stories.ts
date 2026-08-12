import type { Meta, StoryObj } from '@storybook/vue3'
import AdminStatCard from './AdminStatCard.vue'

const meta: Meta<typeof AdminStatCard> = {
  title: 'Admin/AdminStatCard',
  component: AdminStatCard,
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
  argTypes: {
    label: { control: 'text' },
    value: { control: 'text' },
    icon: { control: 'text' },
    color: { control: 'color' }
  }
}

export default meta
type Story = StoryObj<typeof AdminStatCard>

export const Default: Story = {
  args: {
    label: 'Total Users',
    value: 1234,
    icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z',
    color: 'var(--tjg-color-primary-500)'
  }
}

export const WithTrendUp: Story = {
  args: {
    label: 'Active Users',
    value: '8,452',
    icon: 'M13 7h8m0 0v8m0-8l-8 8-4-4-6 6',
    color: 'var(--tjg-color-success-500)',
    trend: {
      value: '+12.5%',
      direction: 'up',
      label: 'vs last week'
    }
  }
}

export const WithTrendDown: Story = {
  args: {
    label: 'Error Rate',
    value: '0.3%',
    icon: 'M12 9v2m0 4h.01M5.07 19h13.86c1.54 0 2.5-1.67 1.73-3L13.73 4a2 2 0 00-3.46 0L3.34 16c-.77 1.33.19 3 1.73 3z',
    color: 'var(--tjg-color-danger-500)',
    trend: {
      value: '-5.2%',
      direction: 'down',
      label: 'vs last week'
    }
  }
}

export const Neutral: Story = {
  args: {
    label: 'Storage Used',
    value: '456 GB',
    icon: 'M4 7v10c0 2.21 3.58 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.58 4 8 4s8-1.79 8-4M4 7c0-2.21 3.58-4 8-4s8 1.79 8 4',
    color: 'var(--tjg-color-warning-500)',
    trend: {
      value: '0%',
      direction: 'neutral'
    }
  }
}
