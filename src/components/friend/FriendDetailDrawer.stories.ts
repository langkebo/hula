import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { defineComponent, ref } from 'vue'

import { createSidebarFrameStyle, resetStorybookMocks } from '~/.storybook/harness'
import FriendDetailDrawer from './FriendDetailDrawer.vue'

const storyFrameStyle = createSidebarFrameStyle(520)

const meta = {
  title: 'Components/Friend/FriendDetailDrawer',
  component: FriendDetailDrawer,
  parameters: {
    layout: 'fullscreen',
    controls: { disable: true }
  }
} satisfies Meta<typeof FriendDetailDrawer>

export default meta
type Story = StoryObj<typeof meta>

const render: Story['render'] = (args) =>
  defineComponent({
    components: { FriendDetailDrawer },
    setup() {
      resetStorybookMocks()
      const show = ref(args.show ?? true)
      const userId = ref(args.userId ?? '')
      return { show, userId, storyFrameStyle }
    },
    template: `
      <div :style="storyFrameStyle">
        <FriendDetailDrawer v-model:show="show" v-model:user-id="userId" />
      </div>
    `
  })

export const Default: Story = {
  args: {
    show: true,
    userId: '@alice:example.com'
  },
  render
}

export const Empty: Story = {
  args: {
    show: true,
    userId: ''
  },
  render
}
