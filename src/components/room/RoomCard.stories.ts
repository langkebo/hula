import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { defineComponent } from 'vue'
import RoomCard from './RoomCard.vue'

/**
 * 房间发现卡片（§17 列表容器）。
 *
 * 图片为远程地址：离线预览时头像区会回落为底色，但 DOM 结构与
 * `loading="lazy" decoding="async"` 属性仍可被视觉回归快照与源码守卫覆盖。
 */
const frameStyle = 'width: 360px; padding: 12px;'

const meta = {
  title: 'Components/Room/RoomCard',
  component: RoomCard,
  parameters: {
    layout: 'centered'
  },
  args: {
    item: {
      roomId: '!room-design:example.com',
      name: 'Design Guild',
      topic: 'Weekly critique, delivery checklist, and review cadence for the design guild',
      numJoinedMembers: 42,
      isFederated: false
    }
  },
  render: (args) =>
    defineComponent({
      components: { RoomCard },
      setup() {
        return {
          args,
          frameStyle
        }
      },
      template: `
        <div :style="frameStyle">
          <RoomCard v-bind="args" />
        </div>
      `
    })
} satisfies Meta<typeof RoomCard>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const WithAvatar: Story = {
  args: {
    item: {
      roomId: '!room-assets:example.com',
      name: 'Asset Library',
      topic: 'Shared media, brand kits, and release assets',
      numJoinedMembers: 128,
      avatarUrl:
        'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=abstract%20geometric%20avatar&image_size=square',
      isFederated: false
    }
  }
}

export const FederatedLongTopic: Story = {
  args: {
    item: {
      roomId: '!room-fed:remote.example',
      name: 'Interop Working Group',
      topic:
        'A deliberately long topic that must be truncated at sixty characters so the layout does not grow beyond two lines',
      numJoinedMembers: 1024,
      isFederated: true
    }
  }
}
