import { shallowMount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'

// Minimal mocks so AccountSettings can mount in isolation. The SFC's setup()
// calls useDialog (needs an <n-dialog-provider>) and pinia stores directly.
vi.mock('naive-ui', async (importOriginal) => {
  const actual = await importOriginal<typeof import('naive-ui')>()
  return {
    ...actual,
    useDialog: () => ({ warning: vi.fn() })
  }
})

vi.mock('@/stores/domains/chat/matrix', () => ({
  useMatrixStore: () => ({ userId: '' })
}))

vi.mock('@/stores/domains/user/user', () => ({
  useUserStore: () => ({
    currentUserAvatarUrl: '',
    currentUserDisplayName: '',
    userInfo: null,
    matrixProfile: null,
    updateAvatar: vi.fn().mockResolvedValue(undefined)
  })
}))

import AccountSettings from '../AccountSettings.vue'

describe('ThreepidManager integration in AccountSettings', () => {
  it('renders ThreepidManager section', () => {
    const wrapper = shallowMount(AccountSettings, {
      global: {
        renderStubDefaultSlot: true,
        stubs: {
          NCard: { template: '<div><slot/></div>' },
          NButton: true,
          NInput: true,
          'n-card': { template: '<div><slot/></div>' },
          'n-button': true,
          'n-input': true,
          ThreepidManager: { name: 'ThreepidManager', template: '<div data-testid="threepid-manager" />' }
        }
      }
    })
    expect(wrapper.find('[data-testid="threepid-manager"]').exists()).toBe(true)
  })
})
