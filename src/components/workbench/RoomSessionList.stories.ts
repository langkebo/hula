/**
 * VisualSpec: ./docs/ui/HULA_FIGMA_STRUCTURE.md (RoomList/*)
 * StorybookTarget: src/components/workbench/RoomSessionList.stories.ts
 * RuntimeComponent: src/components/workbench/RoomSessionList.vue
 * MigrationId: N/A (New Story)
 */
import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { defineComponent, nextTick, onMounted, ref } from 'vue'

import { RoomTypeEnum } from '@/enums'
import type { SessionItem } from '@/stores/domains/chat/chat/session'

interface StorySessionItem extends SessionItem {
  lastMsg?: string
  lastMsgTime?: string
  isAtMe?: boolean
  highlightCount?: number
  notificationCount?: number
  isTombstoned?: boolean
  membership?: 'join' | 'leave' | 'invite' | 'ban'
}

import { createSidebarFrameStyle, resetStorybookMocks } from '~/.storybook/harness'
import {
  completeStorybookPerfSampleOnNextFrame,
  resetStorybookPerfSamples,
  startStorybookPerfSample
} from '~/.storybook/perf'
import RoomSessionList from './RoomSessionList.vue'

const baseSessions: StorySessionItem[] = [
  {
    roomId: '!room1:example.com',
    name: '🚀 产品设计群',
    avatar: '',
    type: RoomTypeEnum.GROUP,
    unreadCount: 3,
    highlightCount: 1,
    notificationCount: 3,
    activeTime: Date.now() - 10000,
    text: "Hey team, let's review the new mockups for the landing page. I've pushed them to Figma.",
    lastMsgTime: '10:30',
    top: true
  },
  {
    roomId: '!room2:example.com',
    name: 'Alice',
    avatar: '',
    type: RoomTypeEnum.SINGLE,
    unreadCount: 1,
    highlightCount: 0,
    notificationCount: 1,
    activeTime: Date.now() - 20000,
    text: "Sure, I can take a look. What's the deadline for feedback?",
    lastMsgTime: '10:25'
  },
  {
    roomId: '!room3:example.com',
    name: '市场营销活动',
    avatar: '',
    type: RoomTypeEnum.GROUP,
    unreadCount: 0,
    highlightCount: 0,
    notificationCount: 0,
    activeTime: Date.now() - 3600000,
    text: 'Q3 活动报告已发布。',
    lastMsgTime: '09:15'
  },
  {
    roomId: '!room4:example.com',
    name: '已归档项目',
    avatar: '',
    type: RoomTypeEnum.GROUP,
    unreadCount: 0,
    highlightCount: 0,
    notificationCount: 0,
    activeTime: Date.now() - 86400000 * 7,
    text: '此项目已归档。',
    lastMsgTime: '上周',
    isTombstoned: true
  },
  {
    roomId: '!room5:example.com',
    name: '免打扰群聊',
    avatar: '',
    type: RoomTypeEnum.GROUP,
    unreadCount: 12,
    highlightCount: 0,
    notificationCount: 12,
    activeTime: Date.now() - 60000,
    text: '这是一个非常活跃的频道，有很多更新。',
    lastMsgTime: '10:29',
    muteNotification: 1
  }
]

const storyFrameStyle = createSidebarFrameStyle(600)

const meta = {
  title: 'Components/Workbench/RoomSessionList',
  component: RoomSessionList,
  parameters: {
    layout: 'fullscreen',
    controls: { disable: true }
  },
  argTypes: {
    sessionList: { control: 'object' },
    syncLoading: { control: 'boolean' },
    sessionLoading: { control: 'boolean' },
    networkBanner: { control: 'object' },
    emptyDescription: { control: 'text' }
  },
  args: {
    sessionList: baseSessions,
    syncLoading: false,
    sessionLoading: false,
    networkBanner: null,
    emptyDescription: '暂无会话',
    onMsgClick: (_item: SessionItem) => {},
    onMsgDblclick: (_item: SessionItem) => {}
  }
} satisfies Meta<typeof RoomSessionList>

export default meta
type Story = StoryObj<typeof meta>

const render = (args: Record<string, unknown>) =>
  defineComponent({
    components: { RoomSessionList },
    setup() {
      resetStorybookMocks()
      resetStorybookPerfSamples()
      startStorybookPerfSample('ui-room-list-initial-render', {
        route: 'storybook:room-session-list',
        thresholdMs: 200
      })

      onMounted(() => {
        completeStorybookPerfSampleOnNextFrame('ui-room-list-initial-render')
      })

      return {
        args,
        storyFrameStyle
      }
    },
    template: `
      <div :style="storyFrameStyle">
        <RoomSessionList
          :session-list="args.sessionList"
          :sync-loading="args.syncLoading"
          :session-loading="args.sessionLoading"
          :network-banner="args.networkBanner"
          :empty-description="args.emptyDescription"
          :get-item-classes="() => ({})"
          :visible-menu="() => []"
          :visible-special-menu="() => []"
          :on-msg-click="() => {}"
          :on-msg-dblclick="() => {}"
          :on-menu-show="() => {}"
          :on-accept-invite="args.onAcceptInvite"
          :on-reject-invite="args.onRejectInvite"
        />
      </div>
    `
  })

export const Default = {
  render
} as unknown as Story

export const Empty: Story = {
  args: {
    ...Default.args,
    sessionList: []
  },
  render
}

export const Loading: Story = {
  args: {
    ...Default.args,
    sessionList: [],
    sessionLoading: true
  },
  render
}

export const SyncLoading: Story = {
  args: {
    ...Default.args,
    sessionList: baseSessions,
    syncLoading: true
  },
  render
}

export const Reconnecting: Story = {
  args: {
    ...Default.args,
    sessionList: [],
    networkBanner: {
      text: '连接已断开，正在重连…',
      retryable: true
    }
  },
  render
}

export const HighlightUnread: Story = {
  args: {
    ...Default.args,
    sessionList: [
      {
        ...baseSessions[0],
        highlightCount: 1,
        unreadCount: 5,
        notificationCount: 5
      },
      ...baseSessions.slice(1)
    ]
  },
  render
}

export const WithInvitation: Story = {
  args: {
    ...Default.args,
    sessionList: [
      {
        roomId: '!invite1:example.com',
        name: '🎨 UI/UX 审计小组',
        avatar: '',
        type: RoomTypeEnum.GROUP,
        unreadCount: 0,
        highlightCount: 0,
        notificationCount: 0,
        activeTime: Date.now(),
        text: '邀请你加入',
        lastMsgTime: '刚刚',
        membership: 'invite'
      },
      ...baseSessions
    ],
    onAcceptInvite: (item: StorySessionItem) => {
      alert(`Accepted invite for ${item.name}`)
    },
    onRejectInvite: (item: StorySessionItem) => {
      alert(`Rejected invite for ${item.name}`)
    }
  },
  render
}

export const PerfUnreadPatch: Story = {
  args: {
    ...Default.args
  },
  render: (args: Record<string, unknown>) =>
    defineComponent({
      components: { RoomSessionList },
      setup() {
        resetStorybookMocks()
        resetStorybookPerfSamples()

        const sessionList = ref((args.sessionList as StorySessionItem[]).map((item: StorySessionItem) => ({ ...item })))

        startStorybookPerfSample('ui-room-list-initial-render', {
          route: 'storybook:room-session-list-perf',
          thresholdMs: 200
        })

        onMounted(() => {
          completeStorybookPerfSampleOnNextFrame('ui-room-list-initial-render')
        })

        const triggerUnreadPatch = async () => {
          startStorybookPerfSample('ui-room-list-unread-patch', {
            route: 'storybook:room-session-list-unread-patch',
            thresholdMs: 120
          })

          sessionList.value = sessionList.value.map((item: StorySessionItem, index: number) =>
            index === 0
              ? {
                  ...item,
                  unreadCount: (item.unreadCount ?? 0) + 1,
                  notificationCount: (item.notificationCount ?? 0) + 1,
                  highlightCount: 1
                }
              : item
          )

          await nextTick()
          completeStorybookPerfSampleOnNextFrame('ui-room-list-unread-patch')
        }

        return {
          args,
          sessionList,
          storyFrameStyle,
          triggerUnreadPatch
        }
      },
      template: `
        <div style="display: flex; flex-direction: column; gap: 12px;">
          <button
            type="button"
            data-test="perf-room-patch-trigger"
            style="width: fit-content; border: 1px solid var(--hula-border-default); border-radius: 8px; padding: 8px 12px; background: var(--hula-surface-panel);"
            @click="triggerUnreadPatch">
            模拟单条未读 patch
          </button>
          <div :style="storyFrameStyle">
            <RoomSessionList
              :session-list="sessionList"
              :sync-loading="args.syncLoading"
              :session-loading="args.sessionLoading"
              :network-banner="args.networkBanner"
              :empty-description="args.emptyDescription"
              :get-item-classes="() => ({})"
              :visible-menu="() => []"
              :visible-special-menu="() => []"
              :on-msg-click="() => {}"
              :on-msg-dblclick="() => {}"
              :on-menu-show="() => {}"
            />
          </div>
        </div>
      `
    })
}
