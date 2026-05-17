import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { defineComponent } from 'vue'
import FriendListView from '@/components/friend/FriendListView.vue'
import { OnlineEnum } from '@/enums'
import { configureMatrixCapabilityServiceMock, resetStorybookMocks } from '~/.storybook/harness'
import { configureContactStoreMock, type FriendRequestItem, type MatrixContact } from '~/.storybook/mocks/contact-store'

const meta = {
  title: 'Components/Friend/FriendListView',
  component: FriendListView,
  parameters: {
    layout: 'fullscreen',
    controls: { disable: true }
  }
} satisfies Meta<typeof FriendListView>

export default meta
type Story = StoryObj<typeof meta>

const render: Story['render'] = () =>
  defineComponent({
    components: { FriendListView },
    setup() {
      return {}
    },
    template: `<div style="height: 600px; width: 320px;"><FriendListView /></div>`
  })

const mockContacts: MatrixContact[] = [
  {
    userId: '@alice:example.com',
    displayName: 'Alice',
    avatarUrl: '',
    uid: '@alice:example.com',
    name: 'Alice',
    account: 'alice',
    avatar: '',
    activeStatus: OnlineEnum.ONLINE,
    remark: '产品 Alice',
    lastOptTime: Date.now(),
    hideMyPosts: false,
    hideTheirPosts: false,
    friendStatus: 'favorite'
  },
  {
    userId: '@bob:example.com',
    displayName: 'Bob',
    avatarUrl: '',
    uid: '@bob:example.com',
    name: 'Bob',
    account: 'bob',
    avatar: '',
    activeStatus: OnlineEnum.OFFLINE,
    remark: '',
    lastOptTime: Date.now() - 3600_000,
    hideMyPosts: false,
    hideTheirPosts: false,
    friendStatus: 'normal'
  },
  {
    userId: '@charlie:example.com',
    displayName: 'Charlie',
    avatarUrl: '',
    uid: '@charlie:example.com',
    name: 'Charlie',
    account: 'charlie',
    avatar: '',
    activeStatus: OnlineEnum.ONLINE,
    remark: '',
    lastOptTime: Date.now() - 7200_000,
    hideMyPosts: false,
    hideTheirPosts: false,
    friendStatus: 'blocked'
  }
]

const mockRequests: FriendRequestItem[] = [
  {
    userId: '@new:example.com',
    displayName: 'New Friend',
    avatarUrl: '',
    message: '一起聊聊产品设计吧',
    direction: 'incoming'
  }
]

export const Default: Story = {
  loaders: [
    async () => {
      resetStorybookMocks()
      configureMatrixCapabilityServiceMock({
        isLoaded: true,
        canUseFriendList: true
      })
      configureContactStoreMock({
        contactsList: mockContacts,
        requestFriendsList: mockRequests,
        isLoading: false
      })
      return {}
    }
  ],
  render
}

export const Empty: Story = {
  loaders: [
    async () => {
      resetStorybookMocks()
      configureMatrixCapabilityServiceMock({
        isLoaded: true,
        canUseFriendList: true
      })
      configureContactStoreMock({
        contactsList: [],
        requestFriendsList: [],
        isLoading: false
      })
      return {}
    }
  ],
  render
}

export const Loading: Story = {
  loaders: [
    async () => {
      resetStorybookMocks()
      configureMatrixCapabilityServiceMock({
        isLoaded: false,
        canUseFriendList: true
      })
      configureContactStoreMock({
        contactsList: [],
        requestFriendsList: [],
        isLoading: true
      })
      return {}
    }
  ],
  render
}

export const CapabilityOff: Story = {
  loaders: [
    async () => {
      resetStorybookMocks()
      configureMatrixCapabilityServiceMock({
        isLoaded: true,
        canUseFriendList: false
      })
      configureContactStoreMock({
        contactsList: [],
        requestFriendsList: [],
        isLoading: false
      })
      return {}
    }
  ],
  render
}

export const ErrorState: Story = {
  loaders: [
    async () => {
      resetStorybookMocks()
      configureMatrixCapabilityServiceMock({
        isLoaded: true,
        canUseFriendList: true
      })
      configureContactStoreMock({
        contactsList: [],
        requestFriendsList: [],
        isLoading: false,
        lastFriendError: {
          message: '加载好友列表失败'
        }
      })
      return {}
    }
  ],
  render
}

export const RequestsPending: Story = {
  loaders: [
    async () => {
      resetStorybookMocks()
      configureMatrixCapabilityServiceMock({
        isLoaded: true,
        canUseFriendList: true
      })
      configureContactStoreMock({
        contactsList: mockContacts,
        requestFriendsList: mockRequests,
        isLoading: false
      })
      return {}
    }
  ],
  render
}

export const BlockedHiddenMix: Story = {
  loaders: [
    async () => {
      resetStorybookMocks()
      configureMatrixCapabilityServiceMock({
        isLoaded: true,
        canUseFriendList: true
      })
      configureContactStoreMock({
        contactsList: [
          ...mockContacts,
          {
            userId: '@diana:example.com',
            displayName: 'Diana',
            avatarUrl: '',
            uid: '@diana:example.com',
            name: 'Diana',
            account: 'diana',
            avatar: '',
            activeStatus: OnlineEnum.OFFLINE,
            remark: '',
            lastOptTime: Date.now() - 86_400_000,
            hideMyPosts: false,
            hideTheirPosts: false,
            friendStatus: 'hidden'
          }
        ],
        requestFriendsList: [],
        isLoading: false
      })
      return {}
    }
  ],
  render
}
