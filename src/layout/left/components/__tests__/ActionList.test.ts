import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, ref } from 'vue'
import { ShowModeEnum } from '@/enums'

const showMode = ref(ShowModeEnum.TEXT)
const menuTop = ref([
  {
    url: 'message',
    title: 'Message',
    shortTitle: 'Msg',
    icon: 'message',
    iconAction: 'message-action',
    state: 0
  }
])
const plugins = ref([
  {
    url: 'roomList',
    title: 'Room List',
    shortTitle: 'Rooms',
    icon: 'view-grid-card',
    iconAction: 'view-grid-card-action',
    isAdd: true,
    miniShow: false,
    badge: 2,
    size: { width: 600, height: 800, minWidth: 600, minHeight: 550 },
    window: { resizable: true }
  },
  {
    url: 'space',
    title: 'Space List',
    shortTitle: 'Spaces',
    icon: 'peoples-two',
    iconAction: 'peoples-two-action',
    isAdd: true,
    miniShow: false,
    badge: 1
  },
  {
    url: 'robot',
    title: 'Robot',
    shortTitle: 'Bot',
    icon: 'robot',
    iconAction: 'GPT',
    isAdd: true,
    miniShow: false,
    badge: 0,
    size: { width: 1200, height: 800 },
    window: { resizable: true }
  }
])

const activeUrl = ref('space')
const openWindowsList = ref(new Set<string>(['roomList']))
const settingShow = ref(false)
const tipShow = ref(false)
const pageJumps = vi.fn()
const updatePlugin = vi.fn()
const addListener = vi.fn(async () => {})
const invoke = vi.fn(async () => {})
const createWebviewWindow = vi.fn(async () => undefined)
const logout = vi.fn(async () => undefined)
const emit = vi.fn()

const passthrough = (name: string) =>
  defineComponent({
    name,
    props: {
      show: {
        type: Boolean,
        default: false
      }
    },
    emits: ['update:show'],
    setup(_, { slots }) {
      return () => h('div', { 'data-test': name }, [...(slots.trigger?.() ?? []), ...(slots.default?.() ?? [])])
    }
  })

const registerMocks = () => {
  vi.doMock('vue-i18n', async (importOriginal) => {
    const actual = await importOriginal<typeof import('vue-i18n')>()
    return {
      ...actual,
      useI18n: () => ({
        t: (key: string) => key
      })
    }
  })

  vi.doMock('@/services/i18n', () => ({
    useI18nGlobal: () => ({
      t: (key: string) => key
    })
  }))

  vi.doMock('pinia', async (importOriginal) => {
    const actual = await importOriginal<typeof import('pinia')>()
    return {
      ...actual,
      storeToRefs: (store: object) => store
    }
  })

  vi.doMock('@/services/matrix/MatrixCapabilityService', () => ({
    matrixCapabilityService: {
      hasCapability: vi.fn(() => false)
    }
  }))

  vi.doMock('@/stores/domains/admin/admin', () => ({
    useAdminStore: () => ({
      canAccessAdmin: false
    })
  }))

  vi.doMock('@tauri-apps/api/core', () => ({
    invoke
  }))

  vi.doMock('@tauri-apps/api/webviewWindow', () => ({
    WebviewWindow: {
      getCurrent: () => ({
        listen: vi.fn(async () => () => {})
      })
    }
  }))

  vi.doMock('@/composables/common/useTauriListener', () => ({
    useTauriListener: () => ({
      addListener
    })
  }))

  vi.doMock('@/composables/common/useWindow', () => ({
    useWindow: () => ({
      createWebviewWindow
    })
  }))

  vi.doMock('@/shared/composables/useLoginFlow', () => ({
    useLoginFlow: () => ({
      logout
    })
  }))

  vi.doMock('@/composables/common/useMitt', () => ({
    useMitt: {
      emit
    }
  }))

  vi.doMock('@/utils/Logger', () => ({
    createLogger: () => ({
      debug: vi.fn(),
      error: vi.fn(),
      info: vi.fn(),
      warn: vi.fn()
    })
  }))

  vi.doMock('@/utils/TauriInvokeHandler', () => ({
    invokeSilently: vi.fn()
  }))

  vi.doMock('@/stores/domains/widget/global', () => ({
    useGlobalStore: () => ({
      unreadReady: true,
      messageUnreadCount: 3,
      contactUnreadCount: 1
    })
  }))

  vi.doMock('@/stores/domains/settings/menuTop', () => ({
    useMenuTopStore: () => ({
      menuTop
    })
  }))

  vi.doMock('@/stores/domains/settings/plugins', () => ({
    usePluginsStore: () => ({
      plugins,
      updatePlugin
    })
  }))

  vi.doMock('@/stores/domains/settings/setting', () => ({
    useSettingStore: () => ({
      showMode
    })
  }))

  vi.doMock('../../hook.ts', () => ({
    leftHook: () => ({
      activeUrl,
      openWindowsList,
      settingShow,
      tipShow,
      pageJumps
    })
  }))

  vi.doMock('../definePlugins/index.vue', () => ({
    default: defineComponent({
      name: 'DefinePluginsStub',
      setup() {
        return () => h('div', { 'data-test': 'define-plugins-stub' })
      }
    })
  }))

  vi.doMock('@/components/common/HomeserverDialog.vue', () => ({
    default: defineComponent({
      name: 'HomeserverDialogStub',
      setup() {
        return () => h('div', { 'data-test': 'homeserver-dialog-stub' })
      }
    })
  }))
}

describe('ActionList', () => {
  beforeEach(() => {
    vi.resetModules()
    showMode.value = ShowModeEnum.TEXT
    activeUrl.value = 'space'
    openWindowsList.value = new Set(['roomList'])
    settingShow.value = false
    tipShow.value = false
    pageJumps.mockReset()
    updatePlugin.mockReset()
    addListener.mockClear()
    invoke.mockClear()
    createWebviewWindow.mockClear()
    logout.mockClear()
    emit.mockClear()
    Object.defineProperty(window, 'innerHeight', {
      value: 1200,
      writable: true,
      configurable: true
    })
    registerMocks()
  })

  const mountActionList = async () => {
    const { default: ActionList } = await import('../ActionList.vue')

    return mount(ActionList, {
      global: {
        stubs: {
          NBadge: passthrough('NBadge'),
          NPopover: passthrough('NPopover'),
          NFlex: passthrough('NFlex')
        }
      }
    })
  }

  it('renders room and space as dedicated workspace entries in text mode', async () => {
    const wrapper = await mountActionList()

    const workspaceEntries = wrapper.findAll('.workspace-entry')
    expect(workspaceEntries).toHaveLength(2)

    const workspaceText = wrapper.get('[data-test="workspace-entry-group"]').text()
    expect(workspaceText).toContain('Rooms')
    expect(workspaceText).toContain('Spaces')
    expect(workspaceText).not.toContain('Room List')
    expect(workspaceText).not.toContain('Space List')
    expect(workspaceText).not.toContain('Robot')
    workspaceEntries.forEach((entry) => {
      expect(entry.findAll('.workspace-entry__label')).toHaveLength(1)
      expect(entry.find('.workspace-entry__content').exists()).toBe(true)
    })
  }, 60000)

  it('reuses the existing jump logic and active/open icon states for workspace entries', async () => {
    const wrapper = await mountActionList()

    const hrefs = wrapper.findAll('.workspace-entry use').map((node) => node.attributes('href'))
    expect(hrefs).toEqual(['#view-grid-card-action', '#peoples-two-action'])
    expect(wrapper.findAll('.workspace-entry--open')).toHaveLength(1)
    expect(wrapper.findAll('.workspace-entry--active')).toHaveLength(1)

    await wrapper.findAll('.workspace-entry')[0].trigger('click')

    expect(pageJumps).toHaveBeenCalledWith(
      'roomList',
      'Room List',
      { width: 600, height: 800, minWidth: 600, minHeight: 550 },
      { resizable: true }
    )
  }, 60000)

  it('collapses workspace entries to icon-only pills in icon mode', async () => {
    showMode.value = ShowModeEnum.ICON

    const wrapper = await mountActionList()

    const workspaceEntries = wrapper.findAll('.workspace-entry')
    expect(workspaceEntries).toHaveLength(2)
    workspaceEntries.forEach((entry) => {
      expect(entry.classes()).toContain('workspace-entry--icon')
      expect(entry.find('.workspace-entry__content').exists()).toBe(false)
    })
  })
})
