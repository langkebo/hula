import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { h } from 'vue'

import Details from '@/components/rightBox/Details.vue'
import { RoomTypeEnum } from '@/enums'
import {
  configureChatSidebarMocks,
  configureWorkbenchMocks,
  createSidebarFrameStyle,
  resetStorybookMocks
} from '~/.storybook/harness'
import { ANNOUNCEMENT_MOCKS, GROUP_DETAIL_MOCKS, GROUP_MEMBER_MOCKS, SPACE_ROOM_MOCKS } from '~/.storybook/mock-data'
import { configureGlobalStoreMock } from '~/.storybook/mocks/global-store'

const meta: Meta<typeof Details> = {
  title: 'components/rightBox/Details',
  component: Details,
  render: (args: Record<string, unknown>) => ({
    components: { Details },
    setup() {
      return () => h('div', { style: createSidebarFrameStyle(600) }, h(Details, args))
    }
  }),
  parameters: {
    layout: 'fullscreen'
  },
  tags: ['autodocs']
}

export default meta
type Story = StoryObj<typeof meta>

export const ShowChatSidebar: Story = {
  loaders: [
    async () => {
      resetStorybookMocks()
      configureChatSidebarMocks({
        detail: GROUP_DETAIL_MOCKS.private,
        members: GROUP_MEMBER_MOCKS.slice(0, 5),
        announcements: ANNOUNCEMENT_MOCKS.slice(0, 3)
      })
      configureGlobalStoreMock({ roomType: RoomTypeEnum.GROUP })
      return {}
    }
  ],
  args: {
    content: {
      type: RoomTypeEnum.GROUP,
      uid: GROUP_DETAIL_MOCKS.private.roomId ?? ''
    }
  }
}

export const ShowGroupDetails: Story = {
  loaders: [
    async () => {
      resetStorybookMocks()
      configureWorkbenchMocks({
        detail: GROUP_DETAIL_MOCKS.private,
        members: GROUP_MEMBER_MOCKS.slice(0, 10),
        announcements: ANNOUNCEMENT_MOCKS.slice(0, 5),
        spaceRooms: SPACE_ROOM_MOCKS
      })
      configureGlobalStoreMock({ roomType: RoomTypeEnum.GROUP })
      return {}
    }
  ],
  args: {
    content: {
      type: RoomTypeEnum.GROUP,
      uid: GROUP_DETAIL_MOCKS.private.roomId ?? ''
    }
  }
}
