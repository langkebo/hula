import type { Meta, StoryObj } from '@storybook/vue3'
import InlineEdit from './InlineEdit.vue'

const meta: Meta<typeof InlineEdit> = {
  title: 'Atomic/InlineEdit',
  component: InlineEdit,
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
  argTypes: {
    label: { control: 'text' },
    value: { control: 'text' },
    placeholder: { control: 'text' },
    multiline: { control: 'boolean' },
    loading: { control: 'boolean' }
  }
}

export default meta
type Story = StoryObj<typeof InlineEdit>

export const Default: Story = {
  args: {
    label: 'Display Name',
    value: 'Alice Wonderland',
    placeholder: 'Enter display name'
  }
}

export const Empty: Story = {
  args: {
    label: 'Bio',
    value: '',
    placeholder: 'Tell something about yourself...'
  }
}

export const Multiline: Story = {
  args: {
    label: 'Description',
    value: 'This is a multi-line description that can be edited inline.',
    placeholder: 'Enter description...',
    multiline: true,
    rows: 3
  }
}

export const Loading: Story = {
  args: {
    label: 'Email',
    value: 'alice@example.com',
    placeholder: 'Enter email',
    loading: true
  }
}
