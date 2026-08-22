import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, defineComponent, ref } from 'vue'

// ============ 共享 mocks ============
vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string, params?: Record<string, unknown>) => (params ? `${key}` : key),
    tm: () => [],
    locale: { value: 'zh-CN' }
  })
}))

vi.mock('vue-router', () => ({
  useRoute: () => ({ name: 'space', path: '/space', params: {}, query: {} }),
  useRouter: () => ({ push: vi.fn(), back: vi.fn(), replace: vi.fn() }),
  onBeforeRouteLeave: vi.fn()
}))

// SpaceCreateRoomPane 是 SpaceList 的新增子组件；桩掉以避免其依赖链
// （openMsgSession → router/index.ts → createRouter）被拉入 SpaceList 测试。
vi.mock('@/components/space/SpaceCreateRoomPane.vue', () => ({
  default: defineComponent({
    name: 'SpaceCreateRoomPaneStub',
    props: { spaceId: String, show: Boolean },
    emits: ['update:show', 'created'],
    template: '<div class="space-create-room-pane-stub" />'
  })
}))

vi.mock('naive-ui', () => ({
  NButton: {
    name: 'NButton',
    emits: ['click'],
    template: '<button @click="$emit(\'click\')"><slot name="icon" /><slot /></button>'
  },
  NIcon: { name: 'NIcon', template: '<i><slot /></i>' },
  NInput: {
    name: 'NInput',
    props: ['value', 'placeholder', 'clearable', 'size'],
    template: '<input />'
  },
  NSpin: { name: 'NSpin', props: ['show'], template: '<div><slot /></div>' },
  NFlex: { name: 'NFlex', template: '<div><slot /></div>' },
  NDivider: { name: 'NDivider', template: '<hr />' },
  NScrollbar: { name: 'NScrollbar', template: '<div><slot /></div>' },
  NEmpty: { name: 'NEmpty', props: ['description'], template: '<div><slot /></div>' },
  NAvatar: { name: 'NAvatar', props: ['src', 'size', 'fallbackSrc'], template: '<div />' },
  NBadge: {
    name: 'NBadge',
    props: ['value', 'max', 'type', 'color', 'dot', 'offset'],
    template: '<span><slot /></span>'
  },
  useDialog: () => ({ warning: vi.fn() })
}))

vi.mock('@iconify/vue', () => ({
  Icon: { name: 'Icon', props: ['icon'], template: '<i class="icon" />' }
}))

vi.mock('@tauri-apps/api/webviewWindow', () => ({
  WebviewWindow: { getCurrent: () => ({ close: vi.fn() }) }
}))

vi.mock('dayjs', () => {
  const dayjsFn = () => ({ format: () => '00:00' })
  Object.assign(dayjsFn, {
    extend: vi.fn(),
    locale: vi.fn(),
    weekday: vi.fn(),
    relativeTime: vi.fn()
  })
  return { default: dayjsFn }
})

vi.mock('@/composables/chat/useEnterChat', () => ({
  useEnterChat: () => ({
    enterChat: vi.fn(async () => undefined),
    enterSpace: vi.fn(async () => undefined)
  })
}))

// ============ SpaceList mocks ============
vi.mock('@/composables/common/useActionFeedback', () => ({
  useActionFeedback: () => ({ showFeedback: vi.fn() })
}))

vi.mock('@/composables/common/useAriaLive', () => ({
  useAriaLive: () => ({ announce: vi.fn() })
}))

vi.mock('@/composables/space', () => ({
  useSpaces: () => ({
    spaces: ref([]),
    loading: ref(false),
    mutating: ref(false),
    error: ref(null),
    load: vi.fn(async () => undefined)
  })
}))

vi.mock('@/services/matrix/room/MatrixSpaceService', () => ({
  matrixSpaceService: {
    leaveSpace: vi.fn(),
    deleteSpace: vi.fn()
  }
}))

vi.mock('@/router/spaceNavigation', () => ({
  buildCreateSpaceRoute: () => ({ name: 'space-create' }),
  buildSpaceRoute: (spaceId: string) => ({ name: 'space-details', params: { spaceId } })
}))

vi.mock('@/composables/search/useSearchShortcut', () => ({
  triggerGlobalSearch: vi.fn()
}))

vi.mock('@/stores/domains/chat/room', () => ({
  useRoomStore: () => ({
    hasTag: vi.fn(() => false),
    addRoomTag: vi.fn(),
    removeRoomTag: vi.fn()
  })
}))

// ============ SettingsDialog mocks ============
vi.mock('@/composables/settings/useSettingsDirtyRegistry', () => ({
  createSettingsDirtyRegistry: vi.fn(() => ({
    hasDirtyTabs: computed(() => false),
    confirmIfNeeded: vi.fn(async () => true),
    clearDirtyTabs: vi.fn()
  })),
  provideSettingsDirtyRegistry: vi.fn(),
  useSettingsTabDirty: vi.fn()
}))

vi.mock('@/composables/settings/useSettingsShell', () => ({
  useSettingsShell: () => ({
    searchQuery: ref(''),
    visibleTabs: computed(() => []),
    filteredTabs: computed(() => []),
    hasSearchQuery: computed(() => false),
    hasSearchResults: computed(() => false),
    setSearchQuery: vi.fn(),
    clearSearch: vi.fn()
  }),
  findFirstMatchingSettingsTab: vi.fn(() => null)
}))

vi.mock('@/composables/usePlatform', () => ({
  usePlatform: () => ({
    isDesktop: true,
    isMobile: false,
    platform: 'desktop',
    isTauri: true,
    isWeb: false
  })
}))

vi.mock('@/stores/domains/settings/settingsTab', () => ({
  useSettingsTabStore: () => ({
    isOpen: true,
    activeTab: 'account',
    setActiveTab: vi.fn(),
    closeDialog: vi.fn(),
    openDialog: vi.fn()
  }),
  getSettingsTabLabel: () => 'Account'
}))

vi.mock('@/utils/AppHarness', () => ({
  hasTauriRuntime: () => false,
  detectAppPlatform: () => 'desktop'
}))

vi.mock('@/views/settingsWindow/tabComponentLoaders', () => ({
  SETTINGS_TAB_COMPONENT_LOADERS: {
    account: () => Promise.resolve({ template: '<div />' })
  }
}))

// ============ DmListView mocks ============
// 注意：@/enums 不 mock，使用真实模块（CreateDmDialog 的 store 定义需要 StoresEnum）

vi.mock('@/services/matrix/room/MatrixDirectMessageService', () => ({
  matrixDirectMessageService: {
    initialize: vi.fn(async () => undefined),
    getDmRoomInfos: vi.fn(async () => []),
    removeDmRoom: vi.fn(async () => undefined)
  }
}))

vi.mock('@/stores/domains/chat/chat', () => ({
  useChatStore: () => ({
    markSessionRead: vi.fn()
  })
}))

vi.mock('@/stores/domains/settings/setting', () => ({
  useSettingStore: () => ({
    themeContent: 'light'
  })
}))

vi.mock('@/stores/domains/widget/global', () => ({
  useGlobalStore: () => ({
    currentSessionRoomId: '',
    updateCurrentSessionRoomId: vi.fn()
  })
}))

vi.mock('@/utils/AvatarUtils', () => ({
  AvatarUtils: {
    getAvatarUrl: vi.fn(() => '')
  }
}))

// 避免 DmListView 子组件的重量级传递依赖（matrix-js-sdk 等）
vi.mock('@/components/dm/CreateDmDialog.vue', () => ({
  default: { name: 'CreateDmDialog', template: '<div />' }
}))

vi.mock('@/components/common/ContextMenu.vue', () => ({
  default: { name: 'ContextMenu', template: '<div />' }
}))

// ============ Tests ============
// 验证三个列表页在 loading 时渲染对应骨架屏
describe('Skeleton integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('SpaceList renders SkeletonSpaceTree when loading', async () => {
    const SpaceList = (await import('@/views/homeWindow/SpaceList.vue')).default
    const wrapper = mount(SpaceList, {
      props: { loading: true },
      shallow: true,
      global: {
        stubs: {
          SkeletonSpaceTree: {
            name: 'SkeletonSpaceTree',
            template: '<div data-testid="skeleton-space" />'
          }
        }
      }
    })
    await flushPromises()
    expect(wrapper.find('[data-testid="skeleton-space"]').exists()).toBe(true)
  })

  it('SettingsPage renders SkeletonSettings when loading', async () => {
    const SettingsPage = (await import('@/views/settingsWindow/SettingsPage.vue')).default
    const wrapper = mount(SettingsPage, {
      props: { loading: true },
      shallow: true,
      global: {
        stubs: {
          SkeletonSettings: {
            name: 'SkeletonSettings',
            template: '<div data-testid="skeleton-settings" />'
          }
        }
      }
    })
    await flushPromises()
    expect(wrapper.find('[data-testid="skeleton-settings"]').exists()).toBe(true)
  })
})
