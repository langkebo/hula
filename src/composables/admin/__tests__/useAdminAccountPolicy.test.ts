import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/services/matrix/admin', () => ({
  adminAccountValidityService: {
    getValidity: vi.fn(),
    createValidity: vi.fn(),
    renewValidity: vi.fn()
  },
  adminPasswordAuthProviderService: {
    listProviders: vi.fn(),
    createProvider: vi.fn()
  },
  adminPolicyServerService: {
    getStatus: vi.fn(),
    check: vi.fn()
  },
  adminRateLimitService: {
    getStatus: vi.fn()
  }
}))

import {
  adminAccountValidityService,
  adminPasswordAuthProviderService,
  adminPolicyServerService,
  adminRateLimitService
} from '@/services/matrix/admin'
import { useAdminAccountPolicy } from '../useAdminAccountPolicy'

const validityInfo = {
  user_id: '@alice:example.org',
  expiration_ts: 1700000000000,
  last_check_at: 1690000000000,
  renewal_token: 'renew-token',
  is_valid: true,
  created_ts: 1680000000000,
  updated_ts: 1695000000000
}

const provider = {
  id: 1,
  provider_name: 'ldap',
  provider_type: 'ldap',
  config: { host: 'ldap.local' },
  is_enabled: true,
  priority: 10,
  created_ts: 1680000000000,
  updated_ts: 1680000000000
}

const policyStatus = { enabled: true, endpoint: 'http://policy.local', fail_mode: 'fail_open' }

const rateLimitStatus = {
  enabled: true,
  backend: 'redis',
  redis_available: true,
  active_rules: 12,
  exempt_paths: 3,
  metrics: {
    requests_total: 1000,
    rejected_total: 25,
    allowed_total: 975,
    exempt_total: 10,
    fail_open_total: 0,
    fail_closed_total: 0,
    rejected_ratio_percent: 2.5
  }
}

describe('useAdminAccountPolicy', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(adminAccountValidityService.getValidity).mockResolvedValue(validityInfo as never)
    vi.mocked(adminAccountValidityService.createValidity).mockResolvedValue(validityInfo as never)
    vi.mocked(adminAccountValidityService.renewValidity).mockResolvedValue(validityInfo as never)
    vi.mocked(adminPasswordAuthProviderService.listProviders).mockResolvedValue([provider] as never)
    vi.mocked(adminPasswordAuthProviderService.createProvider).mockResolvedValue(provider as never)
    vi.mocked(adminPolicyServerService.getStatus).mockResolvedValue(policyStatus as never)
    vi.mocked(adminPolicyServerService.check).mockResolvedValue({ allowed: true, result: 'allow' } as never)
    vi.mocked(adminRateLimitService.getStatus).mockResolvedValue(rateLimitStatus as never)
  })

  it('loadValidity 写入有效期信息，失败时清空并记录错误', async () => {
    const c = useAdminAccountPolicy()
    await c.loadValidity('@alice:example.org')

    expect(adminAccountValidityService.getValidity).toHaveBeenCalledWith('@alice:example.org')
    expect(c.validity.value).toEqual(validityInfo)
    expect(c.validityError.value).toBeNull()
    expect(c.validityLoading.value).toBe(false)

    vi.mocked(adminAccountValidityService.getValidity).mockRejectedValueOnce(new Error('boom'))
    await c.loadValidity('@bob:example.org')
    expect(c.validity.value).toBeNull()
    expect(c.validityError.value).toBe('boom')
  })

  it('setValidity 提交 is_valid 并返回成功标记', async () => {
    const c = useAdminAccountPolicy()
    const ok = await c.setValidity('@alice:example.org', 1700000000000)

    expect(ok).toBe(true)
    expect(adminAccountValidityService.createValidity).toHaveBeenCalledWith({
      user_id: '@alice:example.org',
      expiration_ts: 1700000000000,
      is_valid: true
    })
    expect(c.validity.value).toEqual(validityInfo)
    expect(c.validitySaving.value).toBe(false)
  })

  it('setValidity 失败时记录错误并返回 false', async () => {
    vi.mocked(adminAccountValidityService.createValidity).mockRejectedValueOnce(new Error('denied'))
    const c = useAdminAccountPolicy()

    const ok = await c.setValidity('@alice:example.org', 1700000000000)

    expect(ok).toBe(false)
    expect(c.validityError.value).toBe('denied')
  })

  it('renewValidity 提交续期令牌与新到期时间', async () => {
    const c = useAdminAccountPolicy()
    const ok = await c.renewValidity('@alice:example.org', 'renew-token', 1800000000000)

    expect(ok).toBe(true)
    expect(adminAccountValidityService.renewValidity).toHaveBeenCalledWith('@alice:example.org', {
      renewal_token: 'renew-token',
      new_expiration_ts: 1800000000000
    })
  })

  it('renewValidity 失败时记录错误并返回 false', async () => {
    vi.mocked(adminAccountValidityService.renewValidity).mockRejectedValueOnce(new Error('expired token'))
    const c = useAdminAccountPolicy()

    const ok = await c.renewValidity('@alice:example.org', 'bad', 1800000000000)

    expect(ok).toBe(false)
    expect(c.validityError.value).toBe('expired token')
  })

  it('loadProviders 写入列表，失败时清空并记录错误', async () => {
    const c = useAdminAccountPolicy()
    await c.loadProviders()

    expect(c.providers.value).toEqual([provider])
    expect(c.providersError.value).toBeNull()

    vi.mocked(adminPasswordAuthProviderService.listProviders).mockRejectedValueOnce(new Error('gone'))
    await c.loadProviders()
    expect(c.providers.value).toEqual([])
    expect(c.providersError.value).toBe('gone')
  })

  it('createProvider 去除首尾空白并在成功后刷新列表', async () => {
    const c = useAdminAccountPolicy()
    const ok = await c.createProvider({
      providerName: ' ldap ',
      providerType: ' ldap ',
      config: { host: 'ldap.local' },
      isEnabled: true,
      priority: 10
    })

    expect(ok).toBe(true)
    expect(adminPasswordAuthProviderService.createProvider).toHaveBeenCalledWith({
      provider_name: 'ldap',
      provider_type: 'ldap',
      config: { host: 'ldap.local' },
      is_enabled: true,
      priority: 10
    })
    expect(adminPasswordAuthProviderService.listProviders).toHaveBeenCalledTimes(1)
  })

  it('createProvider 失败时不刷新列表并返回 false', async () => {
    vi.mocked(adminPasswordAuthProviderService.createProvider).mockRejectedValueOnce(new Error('duplicated'))
    const c = useAdminAccountPolicy()

    const ok = await c.createProvider({
      providerName: 'ldap',
      providerType: 'ldap',
      config: {},
      isEnabled: false,
      priority: 0
    })

    expect(ok).toBe(false)
    expect(adminPasswordAuthProviderService.listProviders).not.toHaveBeenCalled()
    expect(c.providersError.value).toBe('duplicated')
  })

  it('loadPolicyStatus 写入状态，失败时记录错误', async () => {
    const c = useAdminAccountPolicy()
    await c.loadPolicyStatus()

    expect(c.policyStatus.value).toEqual(policyStatus)

    vi.mocked(adminPolicyServerService.getStatus).mockRejectedValueOnce(new Error('offline'))
    await c.loadPolicyStatus()
    expect(c.policyStatus.value).toBeNull()
    expect(c.policyError.value).toBe('offline')
  })

  it('runPolicyCheck 写入结果，失败时清空结果并返回 false', async () => {
    const c = useAdminAccountPolicy()
    const ok = await c.runPolicyCheck({
      room_id: '!room:example.org',
      user_id: '@alice:example.org',
      action: 'join'
    })

    expect(ok).toBe(true)
    expect(adminPolicyServerService.check).toHaveBeenCalledWith({
      room_id: '!room:example.org',
      user_id: '@alice:example.org',
      action: 'join'
    })
    expect(c.policyResult.value).toEqual({ allowed: true, result: 'allow' })

    vi.mocked(adminPolicyServerService.check).mockRejectedValueOnce(new Error('deny'))
    const failed = await c.runPolicyCheck({
      room_id: '!room:example.org',
      user_id: '@alice:example.org',
      action: 'send'
    })
    expect(failed).toBe(false)
    expect(c.policyResult.value).toBeNull()
    expect(c.policyError.value).toBe('deny')
  })

  it('loadRateLimit 写入限流状态，失败时记录错误', async () => {
    const c = useAdminAccountPolicy()
    await c.loadRateLimit()

    expect(c.rateLimit.value).toEqual(rateLimitStatus)

    vi.mocked(adminRateLimitService.getStatus).mockRejectedValueOnce(new Error('timeout'))
    await c.loadRateLimit()
    expect(c.rateLimit.value).toBeNull()
    expect(c.rateLimitError.value).toBe('timeout')
  })
})
