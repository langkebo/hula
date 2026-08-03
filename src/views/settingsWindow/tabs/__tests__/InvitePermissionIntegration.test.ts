import { shallowMount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'

// Minimal mocks so SecuritySettings can mount in isolation. The SFC's setup()
// calls useDialog (needs an <n-dialog-provider>) and pinia stores directly.
vi.mock('naive-ui', async (importOriginal) => {
  const actual = await importOriginal<typeof import('naive-ui')>()
  return {
    ...actual,
    useDialog: () => ({ warning: vi.fn() })
  }
})

vi.mock('@/composables/user/useAccount', () => ({
  useAccount: () => ({
    getIgnoredUsers: vi.fn().mockResolvedValue([]),
    setIgnoredUsers: vi.fn().mockResolvedValue(undefined)
  })
}))

vi.mock('@/stores/domains/settings/setting', () => ({
  useSettingStore: () => ({
    isSecretChatConfigured: vi.fn(() => false),
    secretChatEnabled: false,
    secretChatHideSessions: false,
    secretChatAutoLock: false,
    secretChatLockTimeout: 5,
    setSecretChatEnabled: vi.fn(),
    setSecretChatHideSessions: vi.fn(),
    setSecretChatAutoLock: vi.fn(),
    setSecretChatLockTimeout: vi.fn(),
    setSecretChatPassword: vi.fn().mockResolvedValue(undefined),
    clearSecretChatPassword: vi.fn()
  })
}))

vi.mock('@/stores/domains/settings/encryption', () => ({
  useEncryptionStore: () => ({
    encryptionEnabled: false,
    securityKeyConfigured: false,
    loadEncryptionStatus: vi.fn().mockResolvedValue(undefined),
    markSecurityKeyConfigured: vi.fn()
  })
}))

import SecuritySettings from '../SecuritySettings.vue'

describe('InvitePermissionPanel integration in SecuritySettings', () => {
  it('renders InvitePermissionPanel section', () => {
    const wrapper = shallowMount(SecuritySettings, {
      global: {
        renderStubDefaultSlot: true,
        stubs: {
          NCard: { template: '<div><slot/></div>' },
          NSwitch: true,
          NButton: true,
          'n-card': { template: '<div><slot/></div>' },
          'n-switch': true,
          'n-button': true,
          InvitePermissionPanel: {
            name: 'InvitePermissionPanel',
            template: '<div data-testid="invite-permission-panel" />'
          }
        }
      }
    })
    expect(wrapper.find('[data-testid="invite-permission-panel"]').exists()).toBe(true)
  })
})
