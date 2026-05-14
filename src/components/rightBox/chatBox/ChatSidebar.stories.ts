import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { h } from 'vue'

import ChatSidebar from '@/components/rightBox/chatBox/ChatSidebar.vue'
import { RoomTypeEnum } from '@/enums'
import { configureChatSidebarMocks, createSidebarFrameStyle, resetStorybookMocks } from '~/.storybook/harness'
import { ANNOUNCEMENT_MOCKS, GROUP_DETAIL_MOCKS, GROUP_MEMBER_MOCKS } from '~/.storybook/mock-data'
import { configureGlobalStoreMock } from '~/.storybook/mocks/global-store'

const meta: Meta<typeof ChatSidebar> = {
  title: 'components/rightBox/chatBox/ChatSidebar',
  component: ChatSidebar,
  render: (args: Record<string, unknown>) => ({
    components: { ChatSidebar },
    setup() {
      return () => h('div', { style: createSidebarFrameStyle(600) }, h(ChatSidebar, args))
    }
  }),
  parameters: {
    // More on how to position stories at: https://storybook.js.org/docs/vue/configure/story-layout
    layout: 'fullscreen'
  },
  argTypes: {
    // handleResize: { action: 'resized' },
  },
  // This component will have an automatically generated docsPage entry: https://storybook.js.org/docs/vue/writing-docs/autodocs
  tags: ['autodocs']
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  loaders: [
    async () => {
      resetStorybookMocks()
      configureChatSidebarMocks({
        detail: GROUP_DETAIL_MOCKS.private,
        members: GROUP_MEMBER_MOCKS.slice(0, 5),
        announcements: ANNOUNCEMENT_MOCKS.slice(0, 3)
      })
      configureGlobalStoreMock({
        currentSessionRoomId: GROUP_DETAIL_MOCKS.private.roomId,
        roomType: RoomTypeEnum.GROUP
      })
      return {}
    }
  ],
  args: {
    onReady: () => {}
  }
}

export const AnnouncementFlow: Story = {
  loaders: Default.loaders,
  args: Default.args
}
