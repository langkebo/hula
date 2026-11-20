import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  type AccountValidityRenewRequest,
  type AccountValidityRequest,
  AccountValidityService,
  type AdminAccountValidityInfo,
  type AdminPasswordAuthProvider,
  type CreatePasswordAuthProviderRequest,
  PasswordAuthProviderService,
  PolicyServerService,
  RateLimitStatusService
} from '../AccountPolicyService'
import { makePolicyCheckResponse } from './fixtures/accountPolicy'

vi.mock('@tauri-apps/plugin-log', () => ({
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn()
}))

const createAccountValidity = vi.fn()
const getAccountValidity = vi.fn()
const renewAccountValidity = vi.fn()
const listPasswordAuthProviders = vi.fn()
const createPasswordAuthProvider = vi.fn()
const policyGetStatus = vi.fn()
const policyCheck = vi.fn()
const getRateLimitStatus = vi.fn()

const makeDeps = () => {
  const client = {
    getAdminManager: () => ({
      config: {
        createAccountValidity,
        getAccountValidity,
        renewAccountValidity,
        listPasswordAuthProviders,
        createPasswordAuthProvider
      },
      policy: { getStatus: policyGetStatus, check: policyCheck },
      server: { getRateLimitStatus }
    })
  }
  return {
    getClient: () => client as never,
    waitForClientReady: async () => client as never
  }
}

const validityInfo: AdminAccountValidityInfo = {
  user_id: '@alice:example.org',
  expiration_ts: 1700000000000,
  last_check_at: 1690000000000,
  renewal_token: 'renew-token',
  is_valid: true,
  created_ts: 1680000000000,
  updated_ts: 1695000000000
}

const provider: AdminPasswordAuthProvider = {
  id: 1,
  provider_name: 'ldap',
  provider_type: 'ldap',
  config: { host: 'ldap.local' },
  is_enabled: true,
  priority: 10,
  created_ts: 1680000000000,
  updated_ts: 1680000000000
}

describe('AccountValidityService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('createValidity 透传请求体并返回有效期信息', async () => {
    const payload: AccountValidityRequest = {
      user_id: '@alice:example.org',
      expiration_ts: 1700000000000,
      is_valid: true
    }
    createAccountValidity.mockResolvedValueOnce(validityInfo)

    const result = await new AccountValidityService(makeDeps()).createValidity(payload)

    expect(createAccountValidity).toHaveBeenCalledWith(payload)
    expect(result).toEqual(validityInfo)
  })

  it('getValidity 透传 user_id', async () => {
    getAccountValidity.mockResolvedValueOnce(validityInfo)

    const result = await new AccountValidityService(makeDeps()).getValidity('@alice:example.org')

    expect(getAccountValidity).toHaveBeenCalledWith('@alice:example.org')
    expect(result).toEqual(validityInfo)
  })

  it('renewValidity 透传 user_id 与续期请求体', async () => {
    const payload: AccountValidityRenewRequest = {
      renewal_token: 'renew-token',
      new_expiration_ts: 1800000000000
    }
    renewAccountValidity.mockResolvedValueOnce({ ...validityInfo, expiration_ts: 1800000000000 })

    const result = await new AccountValidityService(makeDeps()).renewValidity('@alice:example.org', payload)

    expect(renewAccountValidity).toHaveBeenCalledWith('@alice:example.org', payload)
    expect(result.expiration_ts).toBe(1800000000000)
  })

  it('后端失败时记录日志并重新抛出', async () => {
    createAccountValidity.mockRejectedValueOnce(new Error('HTTP 500'))

    await expect(new AccountValidityService(makeDeps()).createValidity({} as AccountValidityRequest)).rejects.toThrow(
      'HTTP 500'
    )
  })
})

describe('PasswordAuthProviderService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('listProviders 返回裸数组', async () => {
    listPasswordAuthProviders.mockResolvedValueOnce([provider])

    const result = await new PasswordAuthProviderService(makeDeps()).listProviders()

    expect(listPasswordAuthProviders).toHaveBeenCalledTimes(1)
    expect(result).toEqual([provider])
  })

  it('createProvider 透传请求体并返回新建条目', async () => {
    const payload: CreatePasswordAuthProviderRequest = {
      provider_name: 'ldap',
      provider_type: 'ldap',
      config: { host: 'ldap.local' },
      is_enabled: true,
      priority: 10
    }
    createPasswordAuthProvider.mockResolvedValueOnce(provider)

    const result = await new PasswordAuthProviderService(makeDeps()).createProvider(payload)

    expect(createPasswordAuthProvider).toHaveBeenCalledWith(payload)
    expect(result).toEqual(provider)
  })

  it('createProvider 失败时重新抛出', async () => {
    createPasswordAuthProvider.mockRejectedValueOnce(new Error('forbidden'))

    await expect(
      new PasswordAuthProviderService(makeDeps()).createProvider({} as CreatePasswordAuthProviderRequest)
    ).rejects.toThrow('forbidden')
  })
})

describe('PolicyServerService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('getStatus 返回策略服务器状态', async () => {
    const status = { enabled: true, endpoint: 'http://policy.local', fail_mode: 'fail_closed' as const }
    policyGetStatus.mockResolvedValueOnce(status)

    const result = await new PolicyServerService(makeDeps()).getStatus()

    expect(policyGetStatus).toHaveBeenCalledTimes(1)
    expect(result).toEqual(status)
  })

  it('check 透传检查请求并返回结果', async () => {
    const request = { room_id: '!room:example.org', user_id: '@alice:example.org', action: 'join' as const }
    policyCheck.mockResolvedValueOnce(makePolicyCheckResponse())

    const result = await new PolicyServerService(makeDeps()).check(request)

    expect(policyCheck).toHaveBeenCalledWith(request)
    expect(result.reason).toBe('banned word')
  })

  it('check 失败时重新抛出', async () => {
    policyCheck.mockRejectedValueOnce(new Error('policy down'))

    await expect(
      new PolicyServerService(makeDeps()).check({
        room_id: '!room:example.org',
        user_id: '@alice:example.org',
        action: 'create'
      })
    ).rejects.toThrow('policy down')
  })
})

describe('RateLimitStatusService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('getStatus 返回限流状态与指标', async () => {
    const status = {
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
    getRateLimitStatus.mockResolvedValueOnce(status)

    const result = await new RateLimitStatusService(makeDeps()).getStatus()

    expect(getRateLimitStatus).toHaveBeenCalledTimes(1)
    expect(result.metrics.rejected_ratio_percent).toBe(2.5)
  })

  it('getStatus 失败时重新抛出', async () => {
    getRateLimitStatus.mockRejectedValueOnce(new Error('timeout'))

    await expect(new RateLimitStatusService(makeDeps()).getStatus()).rejects.toThrow('timeout')
  })
})
