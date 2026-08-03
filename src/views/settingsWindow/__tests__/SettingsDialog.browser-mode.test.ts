import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, ref } from 'vue'
import { useSettingsTabDirty } from '@/composables/settings/useSettingsDirtyRegistry'
import { useSettingsDialogStore } from '@/stores/domains/settings/settingsDialog'

// M-1 反馈回路：浏览器 dev 模式下 standalone 设置页关闭按钮无响应
// 预期：standalone=true 且 !hasTauriRuntime() 时，关闭按钮应回退到路由返回（router.back）

const dialogWarningMock = vi.fn()
const routerBackMock = vi.fn()
const routerPushMock = vi.fn()

const translationMap: Record<string, string> = {
  'setting.dialog.title': '设置',
  'setting.dialog.current_tab': '当前设置',
  'setting.dialog.search_placeholder': '搜索设置项',
  'setting.dialog.search_aria_label': '搜索设置项',
  'setting.dialog.nav_empty': '未找到匹配的设置项',
  'setting.dialog.nav_aria_label': '设置导航',
  'setting.dialog.dirty_status': '有未保存的更改',
  'setting.dialog.close_title': '关闭设置',
  'setting.dialog.close_aria_label': '关闭设置窗口',
  'setting.dialog.content_aria_label': '设置内容',
  'setting.dialog.switch_title': '切换设置项',
  'setting.dialog.leave_confirm': '继续离开',
  'setting.dialog.leave_cancel': '继续编辑',
  'setting.dialog.tabs.account': '账户'
}

vi.mock('naive-ui', () => ({
  NButton: {
    name: 'NButton',
    emits: ['click'],
    template: '<button class="n-button" type="button" @click="$emit(\'click\')"><slot name="icon" /><slot /></button>'
  },
  NIcon: { name: 'NIcon', template: '<i class="n-icon"><slot /></i>' },
  NInput: {
    name: 'NInput',
    props: ['value', 'clearable', 'placeholder', 'size'],
    emits: ['update:value'],
    template: '<input class="n-input" :value="value" @input="$emit(\'update:value\', $event.target.value)" />'
  },
  useDialog: () => ({
    warning: (...args: unknown[]) => dialogWarningMock(...args)
  })
}))

vi.mock('@iconify/vue', () => ({
  Icon: { name: 'Icon', props: ['icon'], template: '<i class="icon" />' }
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string, params?: Record<string, string>) => {
      if (key === 'setting.dialog.leave_content') {
        return `${params?.label || '当前设置'}存在未保存的更改，继续后这些内容将会丢失。`
      }
      return translationMap[key] ?? key
    },
    tm: () => []
  })
}))

vi.mock('@/composables/usePlatform', () => ({
  usePlatform: () => ({ isDesktop: true, isMobile: false, platform: 'desktop', isTauri: false, isWeb: true })
}))

// 关键：模拟浏览器 dev 模式 — Tauri 不可用
vi.mock('@/utils/AppHarness', () => ({
  hasTauriRuntime: () => false
}))

vi.mock('vue-router', () => ({
  useRouter: () => ({ back: routerBackMock, push: routerPushMock, currentRoute: { value: { path: '/settings' } } })
}))

vi.mock('../SettingsTabNav.vue', () => ({
  default: defineComponent({
    name: 'SettingsTabNav',
    props: ['tabs', 'activeTab'],
    emits: ['change'],
    template:
      '<div class="settings-tab-nav"><button v-for="tab in tabs" :key="tab.id" :data-tab-id="tab.id" @click="$emit(\'change\', tab.id)">{{ tab.label }}</button></div>'
  })
}))

vi.mock('../tabComponentLoaders', () => {
  const accountTabStub = defineComponent({
    name: 'AccountSettingsStub',
    setup() {
      const isDirty = ref(false) // 不脏，避免触发确认对话框
      useSettingsTabDirty('account', isDirty)
      return () => h('div', { class: 'account-tab-stub' }, 'Account')
    }
  })
  return {
    SETTINGS_TAB_COMPONENT_LOADERS: {
      account: () => Promise.resolve(accountTabStub),
      sessions: () => Promise.resolve(defineComponent({ render: () => h('div') })),
      appearance: () => Promise.resolve(defineComponent({ render: () => h('div') })),
      notifications: () => Promise.resolve(defineComponent({ render: () => h('div') })),
      voiceVideo: () => Promise.resolve(defineComponent({ render: () => h('div') })),
      preferences: () => Promise.resolve(defineComponent({ render: () => h('div') })),
      keyboard: () => Promise.resolve(defineComponent({ render: () => h('div') })),
      sidebar: () => Promise.resolve(defineComponent({ render: () => h('div') })),
      securityPrivacy: () => Promise.resolve(defineComponent({ render: () => h('div') })),
      encryption: () => Promise.resolve(defineComponent({ render: () => h('div') })),
      labs: () => Promise.resolve(defineComponent({ render: () => h('div') })),
      mjolnir: () => Promise.resolve(defineComponent({ render: () => h('div') })),
      friends: () => Promise.resolve(defineComponent({ render: () => h('div') })),
      burnAfterRead: () => Promise.resolve(defineComponent({ render: () => h('div') })),
      helpAbout: () => Promise.resolve(defineComponent({ render: () => h('div') }))
    }
  }
})

import SettingsDialog from '../SettingsDialog.vue'

describe('SettingsDialog — M-1 浏览器 dev 模式 standalone 关闭', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setActivePinia(createPinia())
  })

  it('standalone=true 且 !hasTauriRuntime() 时，点击关闭按钮应调用 router.back()', async () => {
    const store = useSettingsDialogStore()
    store.openDialog('account')

    const wrapper = mount(SettingsDialog, {
      props: { standalone: true },
      attachTo: document.body,
      global: { plugins: [createPinia()] }
    })

    await flushPromises()

    // 点击关闭按钮
    await wrapper.find('.n-button').trigger('click')
    await flushPromises()

    // 预期：浏览器模式下应回退到路由返回
    expect(routerBackMock).toHaveBeenCalledTimes(1)
  })
})
