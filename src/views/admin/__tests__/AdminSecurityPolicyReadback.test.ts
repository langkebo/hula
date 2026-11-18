import { shallowMount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AdminSecurity from '../AdminSecurity.vue'

const { getServerConfigMock, updateServerConfigMock, showFeedbackMock } = vi.hoisted(() => ({
  getServerConfigMock: vi.fn(),
  updateServerConfigMock: vi.fn(),
  showFeedbackMock: vi.fn()
}))

vi.mock('@/services/matrix/admin', () => ({
  adminService: {
    getServerConfig: getServerConfigMock,
    updateServerConfig: updateServerConfigMock
  }
}))

vi.mock('@/composables/admin/useAdminSecurity', async () => {
  const { ref } = await import('vue')
  return {
    useAdminSecurity: () => ({
      auditLogs: ref([]),
      loading: ref(false),
      nextBatch: ref(null),
      loadAuditLogs: vi.fn()
    })
  }
})

vi.mock('@/composables/common/useActionFeedback', () => ({
  useActionFeedback: () => ({ showFeedback: showFeedbackMock })
}))

vi.mock('@/utils/Logger', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })
}))

vi.mock('../AdminSecurityIpBlocks.vue', () => ({
  default: { name: 'AdminSecurityIpBlocks', render: () => null }
}))

interface SecurityVm {
  registrationPolicy: 'open' | 'closed' | 'approval'
  passwordPolicy: { minLength: number }
  saveRegistrationPolicy: () => Promise<void>
  savePasswordPolicy: () => Promise<void>
}

const mountPage = () => shallowMount(AdminSecurity, { global: { stubs: { teleport: true } } })
const vmOf = (wrapper: ReturnType<typeof mountPage>) => wrapper.vm as unknown as SecurityVm

describe('AdminSecurity 策略写入后回读', () => {
  beforeEach(() => {
    getServerConfigMock.mockReset()
    updateServerConfigMock.mockReset().mockResolvedValue(undefined)
    showFeedbackMock.mockReset()
  })

  it('保存注册策略后按服务端实际值回读', async () => {
    getServerConfigMock.mockResolvedValue({
      registrations_enabled: false,
      registration_requires_approval: false
    })
    const wrapper = mountPage()
    const vm = vmOf(wrapper)

    vm.registrationPolicy = 'open'
    await vm.saveRegistrationPolicy()

    expect(updateServerConfigMock).toHaveBeenCalledWith({
      registrations_enabled: true,
      registration_requires_approval: false
    })
    expect(getServerConfigMock).toHaveBeenCalledTimes(1)
    expect(vm.registrationPolicy).toBe('closed')
    wrapper.unmount()
  })

  it('保存密码策略后按服务端实际值回读', async () => {
    getServerConfigMock.mockResolvedValue({
      password_policy: {
        minimum_length: 10,
        require_uppercase: true,
        require_lowercase: false,
        require_digit: false,
        require_symbol: false,
        expiry_days: 0
      }
    })
    const wrapper = mountPage()
    const vm = vmOf(wrapper)

    vm.passwordPolicy.minLength = 16
    await vm.savePasswordPolicy()

    expect(getServerConfigMock).toHaveBeenCalledTimes(1)
    expect(vm.passwordPolicy.minLength).toBe(10)
    wrapper.unmount()
  })
})
