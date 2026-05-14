import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { defineComponent, onMounted } from 'vue'
import { RoomTypeEnum } from '@/enums'
import { createSidebarFrameStyle } from '~/.storybook/harness'
import {
  completeStorybookPerfSampleOnNextFrame,
  resetStorybookPerfSamples,
  startStorybookPerfSample
} from '~/.storybook/perf'
import RoomSpaceWorkbench from './RoomSpaceWorkbench.vue'

const frameStyle = `${createSidebarFrameStyle(720)}; width: 100%;`

const spaces = [
  { spaceId: '!space-all:example.com', name: '全部会话', childCount: 18, memberCount: 120 },
  { spaceId: '!space-design:example.com', name: '设计协作', childCount: 6, memberCount: 45 },
  { spaceId: '!space-marketing:example.com', name: '市场增长', childCount: 5, memberCount: 28 },
  { spaceId: '!space-rd:example.com', name: '研发平台', childCount: 7, memberCount: 63 }
]

const sessions = [
  {
    roomId: '!design:example.com',
    name: 'Design Collaboration',
    avatar: '',
    type: RoomTypeEnum.GROUP,
    unreadCount: 4,
    activeTime: Date.now(),
    lastMsg: 'Alice: 请确认本周评审节奏',
    lastMsgTime: '10:42',
    notificationCount: 4,
    highlightCount: 1,
    hasPermission: true
  },
  {
    roomId: '!ops:example.com',
    name: 'Release Ops',
    avatar: '',
    type: RoomTypeEnum.GROUP,
    unreadCount: 1,
    activeTime: Date.now() - 60_000,
    lastMsg: 'Bob: 今晚发布窗口已确认',
    lastMsgTime: '10:21',
    notificationCount: 1,
    highlightCount: 0,
    hasPermission: true
  },
  {
    roomId: '!dm-alice:example.com',
    name: 'Alice',
    avatar: '',
    type: RoomTypeEnum.SINGLE,
    unreadCount: 0,
    activeTime: Date.now() - 120_000,
    lastMsg: '收到，稍后同步',
    lastMsgTime: '09:58',
    notificationCount: 0,
    highlightCount: 0,
    hasPermission: true
  }
]

const meta: Meta<typeof RoomSpaceWorkbench> = {
  title: 'Components/Workbench/RoomSpaceWorkbench',
  component: RoomSpaceWorkbench,
  parameters: {
    layout: 'fullscreen'
  }
}

export default meta
type Story = StoryObj<typeof meta>

const render = (args: Record<string, unknown>) =>
  defineComponent({
    components: { RoomSpaceWorkbench },
    setup() {
      resetStorybookPerfSamples()
      startStorybookPerfSample('ui-space-tree-initial-render', {
        route: 'storybook:room-space-workbench',
        thresholdMs: 220
      })

      onMounted(() => {
        completeStorybookPerfSampleOnNextFrame('ui-space-tree-initial-render')
      })

      return {
        args,
        frameStyle
      }
    },
    template: `
      <div :style="frameStyle">
        <RoomSpaceWorkbench v-bind="args" />
      </div>
    `
  })

export const Default: Story = {
  args: {
    sessionList: sessions,
    totalCount: 18,
    spaces,
    spaceLoading: false,
    selectedSpaceId: '!space-design:example.com',
    searchKeyword: '',
    sessionTypeFilter: 'all',
    sessionSort: 'recent',
    activeSpace: {
      spaceId: '!space-design:example.com',
      name: '设计协作',
      childCount: 6
    },
    canManageActiveSpace: true,
    selectedSession: sessions[0],
    syncLoading: false,
    sessionLoading: false,
    networkBanner: null,
    manageMode: null,
    manageSubmitting: false,
    inviteUserId: '',
    addRoomId: '',
    addRoomSuggested: false,
    settingsName: '设计协作',
    settingsTopic: '设计评审与交付',
    getItemClasses: () => ({}),
    visibleMenu: () => [],
    visibleSpecialMenu: () => [],
    onMsgClick: () => undefined,
    onMsgDblclick: () => undefined,
    onMenuShow: () => undefined,
    onRetryNetwork: () => undefined
  },
  render
}

export const Compact: Story = {
  args: {
    ...Default.args
  },
  render,
  decorators: [
    () => ({
      template: '<div style="width: 900px; height: 100vh; background: var(--hula-surface-panel);"><story /></div>'
    })
  ]
}

export const EmptySessions: Story = {
  args: {
    ...Default.args,
    sessionList: [],
    totalCount: 0,
    selectedSession: null
  },
  render
}

export const Loading: Story = {
  args: {
    ...Default.args,
    spaceLoading: true,
    sessionLoading: true
  },
  render
}

export const HighDensity: Story = {
  args: {
    ...Default.args,
    sessionList: Array.from({ length: 30 }, (_, i) => ({
      roomId: `!room-${i}:example.com`,
      name: `Room ${i + 1}`,
      avatar: '',
      type: i % 3 === 0 ? RoomTypeEnum.GROUP : RoomTypeEnum.SINGLE,
      unreadCount: i % 4 === 0 ? Math.floor(Math.random() * 10) + 1 : 0,
      activeTime: Date.now() - i * 60_000,
      lastMsg: `Message preview for room ${i + 1}`,
      lastMsgTime: `${9 + Math.floor(i / 6)}:${String((i * 7) % 60).padStart(2, '0')}`,
      notificationCount: i % 4 === 0 ? 1 : 0,
      highlightCount: i % 8 === 0 ? 1 : 0,
      hasPermission: true
    })),
    totalCount: 30
  },
  render
}
