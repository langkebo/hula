import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { defineComponent } from 'vue'
import { MessageStatusEnum } from '@/enums'
import matrixClientService from '@/services/matrix/MatrixClientService'
import { matrixMessageService } from '@/services/matrix/messaging/MatrixMessageService'
import { matrixReceiptService } from '@/services/matrix/messaging/MatrixReceiptService'
import { matrixTypingService } from '@/services/matrix/messaging/MatrixTypingService'
import { createSidebarFrameStyle } from '~/.storybook/harness'
import HulaMessageMeta from './HulaMessageMeta.vue'

const storyFrameStyle = createSidebarFrameStyle(180)

const fakeClient = {
  getUserId: () => '@me:example.com',
  getUser: (userId: string) => ({
    presence: userId === '@alice:example.com' ? 'online' : 'offline'
  }),
  getRoom: () => ({
    getMember: (userId: string) => ({
      name: userId === '@alice:example.com' ? 'Alice' : 'Teammate'
    })
  })
}

;(matrixClientService as unknown as { getClient: () => unknown }).getClient = () => fakeClient
;(
  matrixMessageService as typeof matrixMessageService & {
    resolveEventId: (eventId: string) => string
    isLocalEventId: (eventId: string) => boolean
  }
).resolveEventId = (eventId: string) => eventId
;(
  matrixMessageService as typeof matrixMessageService & {
    isLocalEventId: (eventId: string) => boolean
  }
).isLocalEventId = () => false
;(
  matrixReceiptService as unknown as {
    getReadReceipts: (roomId: string, eventId: string) => unknown[]
  }
).getReadReceipts = () => [
  {
    userId: '@alice:example.com',
    displayName: 'Alice',
    avatarUrl: '',
    eventId: '$event-1',
    timestamp: Date.now()
  },
  {
    userId: '@bob:example.com',
    displayName: 'Bob',
    avatarUrl: '',
    eventId: '$event-1',
    timestamp: Date.now()
  }
]
;(
  matrixTypingService as unknown as {
    getTypingUsers: (roomId: string) => unknown[]
  }
).getTypingUsers = () => [{ userId: '@alice:example.com', lastTyped: Date.now() }]

const meta = {
  title: 'Components/RightBox/HulaMessageMeta',
  component: HulaMessageMeta,
  parameters: {
    layout: 'fullscreen'
  },
  args: {
    messageId: '$event-1',
    roomId: '!room:example.com',
    senderId: '@alice:example.com',
    timestamp: Date.now(),
    isMe: false,
    status: MessageStatusEnum.SUCCESS,
    isLastMessage: true
  },
  render: (args) =>
    defineComponent({
      components: { HulaMessageMeta },
      setup() {
        return {
          args,
          storyFrameStyle
        }
      },
      template: `
        <div :style="storyFrameStyle">
          <div style="padding: 12px;">
            <HulaMessageMeta v-bind="args" />
          </div>
        </div>
      `
    })
} satisfies Meta<typeof HulaMessageMeta>

export default meta
type Story = StoryObj<typeof meta>

export const ReceiptsAndPresence: Story = {}

export const Sending: Story = {
  args: {
    isMe: true,
    senderId: '@me:example.com',
    status: MessageStatusEnum.SENDING,
    isLastMessage: false
  }
}

export const RetryState: Story = {
  args: {
    isMe: true,
    senderId: '@me:example.com',
    status: MessageStatusEnum.FAILED,
    isLastMessage: false
  }
}
