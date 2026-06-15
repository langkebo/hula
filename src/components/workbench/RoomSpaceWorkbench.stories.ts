import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { computed, defineComponent, nextTick, onMounted, reactive, ref } from 'vue'
import { RoomTypeEnum } from '@/enums'
import {
  WORKBENCH_SESSION_ENGAGEMENT_FILTERS,
  WORKBENCH_SESSION_SORTS,
  WORKBENCH_SESSION_TYPE_FILTERS
} from '@/router/spaceNavigation'
import { createSidebarFrameStyle } from '~/.storybook/harness'
import {
  completeStorybookPerfSampleOnNextFrame,
  resetStorybookPerfSamples,
  startStorybookPerfSample
} from '~/.storybook/perf'
import RoomSpaceWorkbench from './RoomSpaceWorkbench.vue'

const frameStyle = `${createSidebarFrameStyle(720)}; width: 100%;`
const WORKBENCH_INITIAL_RENDER_SAMPLE = 'ui-room-space-workbench-initial-render'
const DEFAULT_SPACE_ID = '!space-design:example.com'

type StorySpaceTreeNode = {
  spaceId: string
  name: string
  topic?: string
  avatarUrl?: string
  memberCount: number
  childCount: number
}

const storyTreePages: Record<string, { initial: StorySpaceTreeNode[]; more?: StorySpaceTreeNode[] }> = {
  '!space-design:example.com': {
    initial: [
      { spaceId: '!space-design-squad:example.com', name: 'Design Squad', memberCount: 5, childCount: 2 },
      { spaceId: '!space-design-research:example.com', name: 'Research', memberCount: 3, childCount: 0 }
    ],
    more: [{ spaceId: '!space-design-archive:example.com', name: 'Archive', memberCount: 2, childCount: 0 }]
  },
  '!space-design-squad:example.com': {
    initial: [
      { spaceId: '!space-design-icons:example.com', name: 'Icon System', memberCount: 2, childCount: 0 },
      { spaceId: '!space-design-motion:example.com', name: 'Motion Library', memberCount: 2, childCount: 0 }
    ]
  },
  '!space-rd:example.com': {
    initial: [
      { spaceId: '!space-rd-platform:example.com', name: 'Platform', memberCount: 8, childCount: 1 },
      { spaceId: '!space-rd-release:example.com', name: 'Release', memberCount: 4, childCount: 0 }
    ]
  },
  '!space-rd-platform:example.com': {
    initial: [{ spaceId: '!space-rd-observability:example.com', name: 'Observability', memberCount: 3, childCount: 0 }]
  }
}

const createStorySpaceTreeLoader =
  () =>
  async ({
    spaceId,
    from
  }: {
    spaceId: string
    from?: string
  }): Promise<{ rooms: StorySpaceTreeNode[]; next_batch?: string }> => {
    const page = storyTreePages[spaceId]
    if (!page) {
      return { rooms: [] }
    }

    if (from === 'page-2') {
      return { rooms: page.more ?? [] }
    }

    return {
      rooms: page.initial,
      next_batch: page.more?.length ? 'page-2' : undefined
    }
  }

const spaces = [
  { spaceId: '!space-all:example.com', name: '全部会话', childCount: 18, memberCount: 120 },
  { spaceId: '!space-design:example.com', name: '设计协作', childCount: 6, memberCount: 45 },
  { spaceId: '!space-marketing:example.com', name: '市场增长', childCount: 5, memberCount: 28 },
  { spaceId: '!space-rd:example.com', name: '研发平台', childCount: 7, memberCount: 63 }
]

type StorySessionItem = {
  roomId: string
  name: string
  avatar: string
  type: RoomTypeEnum
  unreadCount: number
  activeTime: number
  lastMsg: string
  lastMsgTime: string
  notificationCount: number
  highlightCount: number
  hasPermission: boolean
  membership?: 'join' | 'leave' | 'invite' | 'ban'
}

const sessionPagesBySpace: Record<string, StorySessionItem[][]> = {
  '!space-design:example.com': [
    [
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
    ],
    [
      {
        roomId: '!figma-review:example.com',
        name: 'Figma Review',
        avatar: '',
        type: RoomTypeEnum.GROUP,
        unreadCount: 2,
        activeTime: Date.now() - 180_000,
        lastMsg: 'Carol: 已补交互说明，请看设计稿',
        lastMsgTime: '09:42',
        notificationCount: 2,
        highlightCount: 0,
        hasPermission: true
      },
      {
        roomId: '!ux-research:example.com',
        name: 'UX Research',
        avatar: '',
        type: RoomTypeEnum.GROUP,
        unreadCount: 0,
        activeTime: Date.now() - 240_000,
        lastMsg: '问卷回收已完成，准备同步结论',
        lastMsgTime: '09:31',
        notificationCount: 0,
        highlightCount: 0,
        hasPermission: true
      },
      {
        roomId: '!dm-emma:example.com',
        name: 'Emma',
        avatar: '',
        type: RoomTypeEnum.SINGLE,
        unreadCount: 1,
        activeTime: Date.now() - 300_000,
        lastMsg: '语音纪要已发送',
        lastMsgTime: '09:20',
        notificationCount: 1,
        highlightCount: 0,
        hasPermission: true
      }
    ]
  ],
  '!space-marketing:example.com': [
    [
      {
        roomId: '!campaign:example.com',
        name: 'Campaign Planning',
        avatar: '',
        type: RoomTypeEnum.GROUP,
        unreadCount: 6,
        activeTime: Date.now() - 30_000,
        lastMsg: '推广节奏调整到下周二发布',
        lastMsgTime: '10:44',
        notificationCount: 6,
        highlightCount: 1,
        hasPermission: true
      },
      {
        roomId: '!brand:example.com',
        name: 'Brand Update',
        avatar: '',
        type: RoomTypeEnum.GROUP,
        unreadCount: 0,
        activeTime: Date.now() - 90_000,
        lastMsg: '新一版品牌素材已上传',
        lastMsgTime: '10:18',
        notificationCount: 0,
        highlightCount: 0,
        hasPermission: true
      },
      {
        roomId: '!dm-mia:example.com',
        name: 'Mia',
        avatar: '',
        type: RoomTypeEnum.SINGLE,
        unreadCount: 2,
        activeTime: Date.now() - 150_000,
        lastMsg: '下午一起过一下投放数据',
        lastMsgTime: '10:05',
        notificationCount: 2,
        highlightCount: 0,
        hasPermission: true
      }
    ]
  ],
  '!space-rd:example.com': [
    [
      {
        roomId: '!platform:example.com',
        name: 'Platform Guild',
        avatar: '',
        type: RoomTypeEnum.GROUP,
        unreadCount: 3,
        activeTime: Date.now() - 15_000,
        lastMsg: '发布回滚预案已同步到 runbook',
        lastMsgTime: '10:45',
        notificationCount: 3,
        highlightCount: 0,
        hasPermission: true
      },
      {
        roomId: '!incident:example.com',
        name: 'Incident Room',
        avatar: '',
        type: RoomTypeEnum.GROUP,
        unreadCount: 8,
        activeTime: Date.now() - 45_000,
        lastMsg: '@all 请关注主链路错误率',
        lastMsgTime: '10:40',
        notificationCount: 8,
        highlightCount: 1,
        hasPermission: true
      },
      {
        roomId: '!dm-noah:example.com',
        name: 'Noah',
        avatar: '',
        type: RoomTypeEnum.SINGLE,
        unreadCount: 0,
        activeTime: Date.now() - 150_000,
        lastMsg: '我来补最后一段发布说明',
        lastMsgTime: '10:10',
        notificationCount: 0,
        highlightCount: 0,
        hasPermission: true
      }
    ],
    [
      {
        roomId: '!backend:example.com',
        name: 'Backend Sprint',
        avatar: '',
        type: RoomTypeEnum.GROUP,
        unreadCount: 1,
        activeTime: Date.now() - 210_000,
        lastMsg: '接口变更已合入 develop',
        lastMsgTime: '09:51',
        notificationCount: 1,
        highlightCount: 0,
        hasPermission: true
      },
      {
        roomId: '!frontend:example.com',
        name: 'Frontend Sync',
        avatar: '',
        type: RoomTypeEnum.GROUP,
        unreadCount: 0,
        activeTime: Date.now() - 260_000,
        lastMsg: '今晚把 workbench 样式收口',
        lastMsgTime: '09:40',
        notificationCount: 0,
        highlightCount: 0,
        hasPermission: true
      }
    ]
  ]
}

const cloneSpaces = () => spaces.map((space) => ({ ...space }))
const cloneSessionList = (list: StorySessionItem[]) => list.map((item) => ({ ...item }))
const flattenSessionPages = (pages: StorySessionItem[][], count = pages.length) =>
  cloneSessionList(pages.slice(0, count).flat())
const getSpaceSessionPages = (spaceId: string) => sessionPagesBySpace[spaceId] ?? []
const getLoadedSessionsForSpace = (spaceId: string, loadedPageCount: number) =>
  flattenSessionPages(getSpaceSessionPages(spaceId), loadedPageCount)
const getAllLoadedSessions = (loadedPageCounts: Record<string, number>) =>
  Object.keys(sessionPagesBySpace).flatMap((spaceId) =>
    getLoadedSessionsForSpace(spaceId, loadedPageCounts[spaceId] ?? getSpaceSessionPages(spaceId).length)
  )
const matchesSearchKeyword = (session: StorySessionItem, keyword: string) => {
  const normalizedKeyword = keyword.trim().toLowerCase()
  if (!normalizedKeyword) return true

  return [session.name, session.lastMsg, session.roomId].some((value) =>
    value.toLowerCase().includes(normalizedKeyword)
  )
}
const filterSessions = (
  sessions: StorySessionItem[],
  options: {
    searchKeyword: string
    sessionTypeFilter: string
    sessionEngagementFilter: string
    sessionSort: string
  }
) => {
  const filtered = sessions.filter((session) => {
    if (!matchesSearchKeyword(session, options.searchKeyword)) {
      return false
    }

    if (options.sessionTypeFilter === WORKBENCH_SESSION_TYPE_FILTERS.group && session.type !== RoomTypeEnum.GROUP) {
      return false
    }

    if (options.sessionTypeFilter === WORKBENCH_SESSION_TYPE_FILTERS.single && session.type !== RoomTypeEnum.SINGLE) {
      return false
    }

    switch (options.sessionEngagementFilter) {
      case WORKBENCH_SESSION_ENGAGEMENT_FILTERS.unread:
        return (session.unreadCount ?? 0) > 0
      case WORKBENCH_SESSION_ENGAGEMENT_FILTERS.mention:
        return (session.highlightCount ?? 0) > 0
      case WORKBENCH_SESSION_ENGAGEMENT_FILTERS.invite:
        return session.membership === 'invite'
      default:
        return true
    }
  })

  return filtered.sort((left, right) => {
    if (options.sessionSort === WORKBENCH_SESSION_SORTS.name) {
      return left.name.localeCompare(right.name)
    }

    return right.activeTime - left.activeTime
  })
}
const sessions = flattenSessionPages(getSpaceSessionPages(DEFAULT_SPACE_ID))
const waitForAnimationFrame = () =>
  new Promise<void>((resolve) => {
    if (typeof window === 'undefined') {
      resolve()
      return
    }

    window.requestAnimationFrame(() => resolve())
  })

type PerfHarnessConfig = {
  actionLabel: string
  actionTestId: string
  sampleName: string
  route: string
  thresholdMs: number
  run: (context: {
    searchKeyword: ReturnType<typeof ref<string>>
    selectedSpaceId: ReturnType<typeof ref<string>>
    loadedPageCounts: Record<string, number>
    getVisiblePageCount: (spaceId: string) => number
  }) => Promise<void>
}

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
      startStorybookPerfSample(WORKBENCH_INITIAL_RENDER_SAMPLE, {
        route: 'storybook:room-space-workbench',
        thresholdMs: 220
      })

      onMounted(() => {
        completeStorybookPerfSampleOnNextFrame(WORKBENCH_INITIAL_RENDER_SAMPLE)
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

const renderWithBatchMode = (args: Record<string, unknown>) =>
  defineComponent({
    components: { RoomSpaceWorkbench },
    setup() {
      const rootRef = ref<HTMLElement | null>(null)

      resetStorybookPerfSamples()
      startStorybookPerfSample(WORKBENCH_INITIAL_RENDER_SAMPLE, {
        route: 'storybook:room-space-workbench:batch-mode',
        thresholdMs: 220
      })

      onMounted(async () => {
        await nextTick()
        rootRef.value?.querySelector<HTMLElement>('[data-test="session-batch-toggle"]')?.click()
        await nextTick()
        rootRef.value?.querySelector<HTMLElement>('.hula-room-list-item')?.click()
        completeStorybookPerfSampleOnNextFrame(WORKBENCH_INITIAL_RENDER_SAMPLE)
      })

      return {
        args,
        frameStyle,
        rootRef
      }
    },
    template: `
      <div ref="rootRef" :style="frameStyle">
        <RoomSpaceWorkbench v-bind="args" />
      </div>
    `
  })

const renderWithDetailDrawer = (args: Record<string, unknown>) =>
  defineComponent({
    components: { RoomSpaceWorkbench },
    setup() {
      const rootRef = ref<HTMLElement | null>(null)

      resetStorybookPerfSamples()
      startStorybookPerfSample(WORKBENCH_INITIAL_RENDER_SAMPLE, {
        route: 'storybook:room-space-workbench:narrow-drawer',
        thresholdMs: 220
      })

      onMounted(async () => {
        await nextTick()
        rootRef.value?.querySelector<HTMLElement>('[data-test="workbench-detail-toggle"]')?.click()
        completeStorybookPerfSampleOnNextFrame(WORKBENCH_INITIAL_RENDER_SAMPLE)
      })

      return {
        args,
        frameStyle,
        rootRef
      }
    },
    template: `
      <div ref="rootRef" :style="frameStyle">
        <RoomSpaceWorkbench v-bind="args" />
      </div>
    `
  })

const renderWithPerfHarness = (args: Record<string, unknown>, config: PerfHarnessConfig) =>
  defineComponent({
    components: { RoomSpaceWorkbench },
    setup() {
      const localSpaces = ref(cloneSpaces())
      const selectedSpaceId = ref((args.selectedSpaceId as string) || DEFAULT_SPACE_ID)
      const searchKeyword = ref((args.searchKeyword as string) || '')
      const sessionTypeFilter = ref((args.sessionTypeFilter as string) || WORKBENCH_SESSION_TYPE_FILTERS.all)
      const sessionEngagementFilter = ref(
        (args.sessionEngagementFilter as string) || WORKBENCH_SESSION_ENGAGEMENT_FILTERS.all
      )
      const sessionSort = ref((args.sessionSort as string) || WORKBENCH_SESSION_SORTS.recent)
      const loadedPageCounts = reactive(
        Object.fromEntries(
          Object.keys(sessionPagesBySpace).map((spaceId) => [
            spaceId,
            spaceId === selectedSpaceId.value ? 1 : getSpaceSessionPages(spaceId).length
          ])
        ) as Record<string, number>
      )

      const getVisiblePageCount = (spaceId: string) =>
        Math.min(loadedPageCounts[spaceId] ?? 1, getSpaceSessionPages(spaceId).length)

      const visibleSessions = computed(() => {
        const sourceSessions = selectedSpaceId.value
          ? getLoadedSessionsForSpace(selectedSpaceId.value, getVisiblePageCount(selectedSpaceId.value))
          : getAllLoadedSessions(loadedPageCounts)

        return filterSessions(sourceSessions, {
          searchKeyword: searchKeyword.value,
          sessionTypeFilter: sessionTypeFilter.value,
          sessionEngagementFilter: sessionEngagementFilter.value,
          sessionSort: sessionSort.value
        })
      })

      const totalCount = computed(() => {
        if (!selectedSpaceId.value) {
          return getAllLoadedSessions(loadedPageCounts).length
        }

        return getLoadedSessionsForSpace(selectedSpaceId.value, getVisiblePageCount(selectedSpaceId.value)).length
      })

      const activeSpace = computed(() => {
        if (!selectedSpaceId.value) {
          return null
        }

        const matchedSpace = localSpaces.value.find((space) => space.spaceId === selectedSpaceId.value)
        if (!matchedSpace) {
          return null
        }

        return {
          ...matchedSpace,
          childCount: totalCount.value
        }
      })

      const selectedSession = computed(() => visibleSessions.value[0] ?? null)
      const spaceBreadcrumbItems = computed(() => {
        const activeSpaceItem = activeSpace.value
        if (!activeSpaceItem) {
          return []
        }

        return [
          { spaceId: '!space-all:example.com', name: '全部会话' },
          { spaceId: activeSpaceItem.spaceId, name: activeSpaceItem.name }
        ]
      })

      resetStorybookPerfSamples()
      startStorybookPerfSample(WORKBENCH_INITIAL_RENDER_SAMPLE, {
        route: `${config.route}:initial-render`,
        thresholdMs: 220
      })

      onMounted(() => {
        completeStorybookPerfSampleOnNextFrame(WORKBENCH_INITIAL_RENDER_SAMPLE)
      })

      const triggerPerfSample = async () => {
        startStorybookPerfSample(config.sampleName, {
          route: config.route,
          thresholdMs: config.thresholdMs
        })

        await config.run({
          searchKeyword,
          selectedSpaceId,
          loadedPageCounts,
          getVisiblePageCount
        })

        await nextTick()
        completeStorybookPerfSampleOnNextFrame(config.sampleName)
      }

      return {
        args,
        frameStyle,
        localSpaces,
        selectedSpaceId,
        searchKeyword,
        sessionTypeFilter,
        sessionEngagementFilter,
        sessionSort,
        visibleSessions,
        totalCount,
        activeSpace,
        selectedSession,
        spaceBreadcrumbItems,
        triggerPerfSample,
        actionLabel: config.actionLabel,
        actionTestId: config.actionTestId
      }
    },
    template: `
      <div style="display: flex; flex-direction: column; gap: 12px;">
        <button
          type="button"
          :data-test="actionTestId"
          style="width: fit-content; border: 1px solid var(--hula-border-default); border-radius: 8px; padding: 8px 12px; background: var(--hula-surface-panel);"
          @click="triggerPerfSample">
          {{ actionLabel }}
        </button>
        <div :style="frameStyle">
          <RoomSpaceWorkbench
            v-bind="args"
            :spaces="localSpaces"
            :session-list="visibleSessions"
            :total-count="totalCount"
            :selected-space-id="selectedSpaceId"
            :search-keyword="searchKeyword"
            :session-type-filter="sessionTypeFilter"
            :session-engagement-filter="sessionEngagementFilter"
            :session-sort="sessionSort"
            :active-space="activeSpace"
            :selected-session="selectedSession"
            :space-breadcrumb-items="spaceBreadcrumbItems"
            @update:search-keyword="searchKeyword = $event"
            @update:session-type-filter="sessionTypeFilter = $event"
            @update:session-engagement-filter="sessionEngagementFilter = $event"
            @update:session-sort="sessionSort = $event"
            @update:selected-space-id="selectedSpaceId = $event"
          />
        </div>
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
    hasSavedPreset: false,
    canSavePreset: false,
    savedPresetApplied: false,
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
    spaceTreeLoader: createStorySpaceTreeLoader(),
    onMsgClick: (_item: any) => {},
    onMsgDblclick: (_item: any) => {},
    onRetryNetwork: () => {}
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

export const EmptyByFilter: Story = {
  args: {
    ...Default.args,
    sessionList: [],
    totalCount: 18,
    selectedSession: null,
    searchKeyword: 'roadmap',
    sessionTypeFilter: 'group',
    sessionEngagementFilter: 'unread'
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

export const BatchMode: Story = {
  args: {
    ...Default.args
  },
  render: (args: any) => renderWithBatchMode(args)
}

export const SavedPreset: Story = {
  args: {
    ...Default.args,
    searchKeyword: 'design',
    sessionTypeFilter: 'group',
    sessionEngagementFilter: 'unread',
    hasSavedPreset: true,
    savedPresetApplied: true
  },
  render
}

export const NarrowDrawer: Story = {
  args: {
    ...Default.args,
    layoutModeOverride: 'narrow'
  },
  render: (args: any) => renderWithDetailDrawer(args)
}

export const PerfFilterLatency: Story = {
  args: {
    ...Default.args
  },
  render: (args: any) =>
    renderWithPerfHarness(args, {
      actionLabel: '采样筛选耗时',
      actionTestId: 'perf-filter-latency-trigger',
      sampleName: 'ui-room-space-workbench-filter-latency',
      route: 'storybook:room-space-workbench:filter-latency',
      thresholdMs: 140,
      run: async ({ searchKeyword }) => {
        searchKeyword.value = searchKeyword.value ? '' : 'alice'
      }
    })
}

export const PerfSpaceSwitch: Story = {
  args: {
    ...Default.args
  },
  render: (args: any) =>
    renderWithPerfHarness(args, {
      actionLabel: '采样空间切换耗时',
      actionTestId: 'perf-space-switch-trigger',
      sampleName: 'ui-room-space-workbench-space-switch',
      route: 'storybook:room-space-workbench:space-switch',
      thresholdMs: 180,
      run: async ({ selectedSpaceId, searchKeyword }) => {
        searchKeyword.value = ''
        selectedSpaceId.value =
          selectedSpaceId.value === '!space-rd:example.com' ? DEFAULT_SPACE_ID : '!space-rd:example.com'
      }
    })
}

export const PerfPaginationAppend: Story = {
  args: {
    ...Default.args
  },
  render: (args: any) =>
    renderWithPerfHarness(args, {
      actionLabel: '采样分页追加耗时',
      actionTestId: 'perf-pagination-append-trigger',
      sampleName: 'ui-room-space-workbench-pagination-append',
      route: 'storybook:room-space-workbench:pagination-append',
      thresholdMs: 160,
      run: async ({ selectedSpaceId, loadedPageCounts, getVisiblePageCount }) => {
        const currentSpaceId = selectedSpaceId.value || DEFAULT_SPACE_ID
        const maxPageCount = getSpaceSessionPages(currentSpaceId).length
        if (getVisiblePageCount(currentSpaceId) >= maxPageCount) {
          loadedPageCounts[currentSpaceId] = 1
          await nextTick()
          await waitForAnimationFrame()
        }

        loadedPageCounts[currentSpaceId] = Math.min(getVisiblePageCount(currentSpaceId) + 1, maxPageCount)
      }
    })
}
