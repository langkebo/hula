import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import GuestUpgradeModal from '../GuestUpgradeModal.vue'

const { upgradeGuestAccountMock, applyGuestUpgradeMock, showFeedbackMock, loggerErrorMock } = vi.hoisted(() => ({
  upgradeGuestAccountMock: vi.fn(),
  applyGuestUpgradeMock: vi.fn(),
  showFeedbackMock: vi.fn(),
  loggerErrorMock: vi.fn()
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key })
}))

vi.mock('@/services/matrix/auth/MatrixAuthService', () => ({
  MatrixAuthService: {
    upgradeGuestAccount: upgradeGuestAccountMock
  }
}))

vi.mock('@/services/matrix/auth/SessionOrchestrator', () => ({
  sessionOrchestrator: {
    applyGuestUpgrade: applyGuestUpgradeMock
  }
}))

vi.mock('@/composables/common/useActionFeedback', () => ({
  useActionFeedback: () => ({ showFeedback: showFeedbackMock })
}))

vi.mock('@/utils/Logger', () => ({
  createLogger: () => ({ error: loggerErrorMock, warn: vi.fn(), info: vi.fn(), debug: vi.fn() })
}))

const mountModal = (show = true) =>
  mount(GuestUpgradeModal, {
    props: { show },
    global: {
      stubs: { Teleport: true }
    }
  })

const fillForm = async (wrapper: ReturnType<typeof mountModal>, username: string, password: string) => {
  await wrapper.find('[data-test="guest-upgrade-username"]').setValue(username)
  await wrapper.find('[data-test="guest-upgrade-password"]').setValue(password)
}

describe('GuestUpgradeModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders nothing while hidden', () => {
    const wrapper = mountModal(false)

    expect(wrapper.find('[data-test="guest-upgrade-username"]').exists()).toBe(false)
  })

  it('requires a username before submitting', async () => {
    const wrapper = mountModal()

    await wrapper.find('form').trigger('submit')

    expect(wrapper.find('[data-test="guest-upgrade-error"]').text()).toBe('guest.upgrade.username_required')
    expect(upgradeGuestAccountMock).not.toHaveBeenCalled()
  })

  it('requires a password before submitting', async () => {
    const wrapper = mountModal()
    await fillForm(wrapper, 'alice', '')

    await wrapper.find('form').trigger('submit')

    expect(wrapper.find('[data-test="guest-upgrade-error"]').text()).toBe('guest.upgrade.password_required')
    expect(upgradeGuestAccountMock).not.toHaveBeenCalled()
  })

  it('upgrades the guest account and closes the dialog on success', async () => {
    const result = { userId: '@alice:matrix.org', accessToken: 'new-token' }
    upgradeGuestAccountMock.mockResolvedValue(result)
    applyGuestUpgradeMock.mockResolvedValue(undefined)
    const wrapper = mountModal()
    await fillForm(wrapper, 'alice', 'secret')

    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(upgradeGuestAccountMock).toHaveBeenCalledWith('alice', 'secret')
    expect(applyGuestUpgradeMock).toHaveBeenCalledWith(result)
    expect(showFeedbackMock).toHaveBeenCalledWith('guest.upgrade.success', 'success')
    expect(wrapper.emitted('upgraded')).toHaveLength(1)
    expect(wrapper.emitted('update:show')?.[0]).toEqual([false])
  })

  it('keeps the dialog open with an inline error so the upgrade can be retried', async () => {
    upgradeGuestAccountMock.mockRejectedValue(new Error('upgrade rejected by server'))
    const wrapper = mountModal()
    await fillForm(wrapper, 'alice', 'secret')

    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(loggerErrorMock).toHaveBeenCalled()
    expect(wrapper.emitted('update:show')).toBeUndefined()
    expect(wrapper.emitted('upgraded')).toBeUndefined()
    expect(wrapper.find('[data-test="guest-upgrade-error"]').text()).toContain('upgrade rejected by server')
    expect(wrapper.find('[data-test="guest-upgrade-submit"]').attributes('disabled')).toBeUndefined()
  })

  it('closes on close button click', async () => {
    const wrapper = mountModal()

    await wrapper.find('.guest-upgrade-dialog__close').trigger('click')

    expect(wrapper.emitted('update:show')?.[0]).toEqual([false])
  })
})
