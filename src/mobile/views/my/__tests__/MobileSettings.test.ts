import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import MobileSettings from '../MobileSettings.vue'
import {
  filterMobileSettingsItems,
  getMobileSettingsItemCapabilities,
  MOBILE_ADVANCED_SETTINGS_ITEMS,
  type MobileSettingsNavItem
} from '../mobileSettingsConfig'
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
  showDialog: (...args: unknown[]) => showDialogMock(...args),
  showToast: (...args: unknown[]) => showToastMock(...args)
}))

vi.mock('@iconify/vue', () => ({
  Icon: { name: 'Icon', template: '<i />', props: ['icon', 'width', 'color', 'style'] }
}))

vi.mock('@tauri-apps/plugin-log', () => ({
  info: (...args: unknown[]) => infoMock(...args)
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
    themeContent: 'light',
    languagePreference: 'zh-CN',
    toggleTheme: (...args: unknown[]) => toggleThemeMock(...args),
    toggleLogin: (...args: unknown[]) => toggleLoginMock(...args)
  })
}))

vi.mock('@/stores/domains/user/userStatus', () => ({
  useUserStatusStore: () => ({
    stateId: 'online'
  })
}))

// 登出已抽成 useMobileLogout（唯一实现）。这里只关心设置项渲染，
// 桩掉可避免拉起 useSessionActions → 各 store 的 defineStore 链。
vi.mock('@/composables/user/useMobileLogout', () => ({
  useMobileLogout: () => ({ isLoggingOut: ref(false), handleLogout: logoutMock })
}))

// 能力判定由真实服务提供，但服务模块会把整个 Matrix client 图拉进单测。
// 这里只桩出 MobileSettings 用到的两个字段，并允许按用例改写能力状态。
const capabilityState = vi.hoisted(() => ({
  isLoaded: false,
  isCapabilityAvailable: (_capability: string): boolean => true
}))

vi.mock('@/services/matrix/MatrixCapabilityService', async () => {
  const { ref: createRef } = await import('vue')
  return {
    useServerCapability: () => ({
      isLoaded: createRef(capabilityState.isLoaded),
      isCapabilityAvailable: (capability: string) => capabilityState.isCapabilityAvailable(capability)
    })
  }
})

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
    capabilityState.isLoaded = false
    capabilityState.isCapabilityAvailable = () => true
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

  it('keeps every entry while capability detection is not loaded', () => {
    capabilityState.isLoaded = false
    capabilityState.isCapabilityAvailable = () => false

    const wrapper = mountComponent()
    expect(wrapper.text()).toContain('mobile_setting.voice_video')
  })

  it('hides entries whose required capability is unavailable once loaded', () => {
    capabilityState.isLoaded = true
    capabilityState.isCapabilityAvailable = (capability) => capability !== 'voip'

    const wrapper = mountComponent()
    expect(wrapper.text()).not.toContain('mobile_setting.voice_video')
    expect(wrapper.text()).toContain('mobile_setting.labs')
  })
})

describe('filterMobileSettingsItems', () => {
  const item = (
    titleKey: string,
    requiredCapability?: MobileSettingsNavItem['requiredCapability']
  ): MobileSettingsNavItem => ({
    titleKey,
    path: `/${titleKey}`,
    icon: 'mdi:test',
    iconColor: 'var(--tjg-color-info-500)',
    iconBackgroundColor: 'var(--tjg-color-info-100)',
    ...(requiredCapability ? { requiredCapability } : {})
  })

  it('treats entries without a capability declaration as always available', () => {
    expect(getMobileSettingsItemCapabilities(item('plain'))).toEqual([])
    expect(filterMobileSettingsItems([item('plain')], true, () => false)).toHaveLength(1)
  })

  it('normalizes a single capability declaration to an array', () => {
    expect(getMobileSettingsItemCapabilities(item('voip', 'voip'))).toEqual(['voip'])
  })

  it('requires every declared capability to be available', () => {
    const entries = [item('multi', ['voip', 'friend-list']), item('free')]
    const result = filterMobileSettingsItems(entries, true, (capability) => capability === 'voip')
    expect(result.map((entry) => entry.titleKey)).toEqual(['free'])
  })
})
