import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { defineComponent, ref } from 'vue'
import FriendSearchBar from './FriendSearchBar.vue'

const meta = {
  title: 'Components/Friend/FriendSearchBar',
  component: FriendSearchBar,
  parameters: {
    layout: 'centered'
  }
} satisfies Meta<typeof FriendSearchBar>

export default meta
type Story = StoryObj<typeof meta>

const render = (args: Record<string, unknown>) =>
  defineComponent({
    components: { FriendSearchBar },
    setup() {
      const value = ref('')
      return { args, value }
    },
    template: `
      <div style="width: 320px;">
        <FriendSearchBar
          v-model="value"
          v-bind="args"
        />
      </div>
    `
  })

export const Default: Story = {
  args: {
    placeholder: '搜索好友',
    history: ['Alice', '@bob:example.com', '设计组'],
    modelValue: ''
  },
  render
}

export const NoHistory: Story = {
  args: {
    placeholder: '搜索好友',
    history: [],
    modelValue: 'Alice'
  },
  render
}

export const HiddenHistory: Story = {
  args: {
    placeholder: '搜索好友',
    history: ['Alice', '@bob:example.com', '设计组'],
    showHistory: false,
    modelValue: ''
  },
  render
}

export const Rtl: Story = {
  args: {
    placeholder: 'Search friends',
    history: ['Alice', 'Bob'],
    dir: 'rtl',
    modelValue: ''
  },
  render
}
