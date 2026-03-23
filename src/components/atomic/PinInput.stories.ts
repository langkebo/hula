import type { Meta, StoryObj } from '@storybook/vue3'
import PinInput from './PinInput.vue'

const meta: Meta<typeof PinInput> = {
  title: 'Atomic/PinInput',
  component: PinInput,
  tags: ['autodocs'],
  argTypes: {
    length: { control: { type: 'number', min: 4, max: 8 } },
    modelValue: { control: 'text' },
    size: { control: 'text' },
    inputClass: { control: 'text' },
    'onUpdate:modelValue': { action: 'update:modelValue' },
    onComplete: { action: 'complete' }
  }
}

export default meta
type Story = StoryObj<typeof PinInput>

export const Default: Story = {
  args: {
    length: 6,
    size: '42px'
  }
}

export const FourDigits: Story = {
  args: {
    length: 4,
    size: '50px'
  }
}

export const WithInitialValue: Story = {
  args: {
    length: 6,
    size: '42px',
    modelValue: '123'
  }
}
