import { mount } from '@vue/test-utils'
import { ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import MobileSettings from '../MobileSettings.vue'
import { MOBILE_ADVANCED_SETTINGS_ITEMS } from '../mobileSettingsConfig'
import { MOBILE_SETTINGS_LABS_PATH } from '../settingsRoutes'

const routerPushMock = vi.fn()
const showDialogMock = vi.fn()
const showToastMock = vi.fn()
const infoMock = vi.fn()
const logoutMock = vi.fn()
const toggleThemeMock = vi.fn()
const toggleLoginMock = vi.fn()

vi.mock('pinia', () => ({
  storeToRefs: () => ({
    isTrayMenuShow: ref(false)
  })
}))

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: routerPushMock })
}))

vi.mock('vant', () => ({
  showDialog: (...args: any[]) => showDialogMock(...args),
  showToast: (...args: any[]) => showToastMock(...args)
}))

vi.mock('@iconify/vue', () => ({
  Icon: { name: 'Icon', template: '<i />', props: ['icon', 'width', 'color', 'style'] }
}))

vi.mock('@tauri-apps/plugin-log', () => ({
  info: (...args: any[]) => infoMock(...args)
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key,
    locale: ref('zh-CN')
  })
}))

vi.mock('@/stores/domains/widget/global', () => ({
  useGlobalStore: () => ({
    isTrayMenuShow: false
  })
}))

vi.mock('@/stores/domains/settings/setting', () => ({
  useSettingStore: () => ({
    themes: { content: 'light' },
    page: { lang: 'zh-CN' },
    toggleTheme: (...args: any[]) => toggleThemeMock(...args),
    toggleLogin: (...args: any[]) => toggleLoginMock(...args)
  })
}))

vi.mock('@/stores/domains/user/userStatus', () => ({
  useUserStatusStore: () => ({
    stateId: 'online'
  })
}))

vi.mock('@/hooks/useLoginFlow', () => ({
  useLoginFlow: () => ({ logout: logoutMock })
}))

vi.mock('@/mobile/components/chat-room/AutoFixHeightPage.vue', () => ({
  default: {
    name: 'AutoFixHeightPage',
    template: '<div><slot name="header" /><slot name="container" /></div>',
    props: ['showFooter']
  }
}))

vi.mock('@/mobile/components/chat-room/HeaderBar.vue', () => ({
  default: {
    name: 'HeaderBar',
    template: '<div />',
    props: ['border', 'isOfficial', 'hiddenRight', 'roomName']
  }
}))

const VanCellStub = {
  name: 'VanCell',
  props: ['title', 'label', 'isLink'],
  template: `
    <div class="van-cell" @click="$emit('click')">
      <span class="van-cell__title">{{ title }}</span>
      <span v-if="label" class="van-cell__label">{{ label }}</span>
      <slot name="icon" />
      <slot name="value" />
      <slot name="right-icon" />
    </div>
  `
}

describe('MobileSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    showDialogMock.mockReturnValue(Promise.resolve())
  })

  function mountComponent() {
    return mount(MobileSettings, {
      global: {
        stubs: {
          'van-cell-group': { template: '<div><slot /></div>' },
          'van-cell': VanCellStub,
          'van-radio-group': { template: '<div><slot /></div>', props: ['modelValue', 'direction'] },
          'van-radio': { template: '<label><slot /></label>', props: ['name'] },
          'van-button': { template: '<button><slot /></button>', props: ['type', 'block', 'disabled', 'loading'] }
        }
      }
    })
  }

  it('shows labs as a first-level entry', () => {
    const wrapper = mountComponent()
    expect(wrapper.text()).toContain('mobile_setting.labs')
  })

  it('uses the advanced settings config without a top-level integrations item', () => {
    expect(MOBILE_ADVANCED_SETTINGS_ITEMS.map((item) => item.titleKey)).toContain('mobile_setting.labs')
    expect(MOBILE_ADVANCED_SETTINGS_ITEMS.map((item) => item.titleKey)).not.toContain('mobile_setting.integrations')
  })

  it('does not show integrations as a first-level entry', () => {
    const wrapper = mountComponent()
    expect(wrapper.text()).not.toContain('mobile_setting.integrations')
  })

  it('navigates to labs from the first-level settings list', async () => {
    const wrapper = mountComponent()
    const labsCell = wrapper.findAll('.van-cell').find((cell) => cell.text().includes('mobile_setting.labs'))

    expect(labsCell).toBeDefined()
    await labsCell!.trigger('click')
    expect(routerPushMock).toHaveBeenCalledWith(MOBILE_SETTINGS_LABS_PATH)
  })
})
