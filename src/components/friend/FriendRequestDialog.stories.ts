import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { defineComponent, ref } from 'vue'
import {
  configureContactStoreMock,
  type FriendRequestItem,
  resetContactStoreMock
} from '~/.storybook/mocks/contact-store'
import { configureOpenMsgSessionMock, resetOpenMsgSessionMock } from '~/.storybook/mocks/open-msg-session'
import {
  completeStorybookPerfSampleOnNextFrame,
  resetStorybookPerfSamples,
  startStorybookPerfSample
} from '~/.storybook/perf'
import FriendRequestDialog from './FriendRequestDialog.vue'

const incomingRequests: FriendRequestItem[] = [
  {
    userId: '@alice:example.com',
    displayName: 'Alice',
    avatarUrl: '',
    message: '想和你建立一个稳定的 DM 会话',
    direction: 'incoming'
  }
]

const meta: Meta<typeof FriendRequestDialog> = {
  title: 'Components/Friend/FriendRequestDialog',
  component: FriendRequestDialog,
  parameters: {
    layout: 'fullscreen'
  }
}

export default meta
type Story = StoryObj<typeof meta>

const render = () =>
  defineComponent({
    components: { FriendRequestDialog },
    setup() {
      const visible = ref(true)

      resetStorybookPerfSamples()
      resetContactStoreMock()
      resetOpenMsgSessionMock()

      configureOpenMsgSessionMock({ latencyMs: 18 })
      configureContactStoreMock({
        requestFriendsList: incomingRequests,
        loadFriendRequests: async () => undefined,
        acceptFriendRequest: async () => {
          startStorybookPerfSample('ui-friend-request-jump', {
            route: 'storybook:friend-request-jump',
            thresholdMs: 180
          })
          await new Promise<void>((resolve: () => void) => window.setTimeout(resolve, 16))
          return '!dm:example.com'
        },
        rejectFriendRequest: async () => undefined,
        cancelFriendRequest: async () => undefined
      })

      startStorybookPerfSample('ui-friend-request-dialog-render', {
        route: 'storybook:friend-request-dialog',
        thresholdMs: 180
      })
      completeStorybookPerfSampleOnNextFrame('ui-friend-request-dialog-render')

      if (typeof window !== 'undefined') {
        ;(window as Window & { __HULA_OPEN_MSG_SESSION_CALLS__?: unknown[] }).__HULA_OPEN_MSG_SESSION_CALLS__ = []
      }

      return { visible }
    },
    template: `
      <div style="min-height: 520px;">
        <FriendRequestDialog v-model:show="visible" />
      </div>
    `
  })

export const Default: Story = {
  render
}
