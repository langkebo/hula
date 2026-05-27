import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AdminSecurityService } from '../SecurityService'

vi.mock('@tauri-apps/plugin-log', () => ({
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn()
}))

const makeAdmin = () => ({
  getFederationDestinations: vi.fn(),
  getFederationDestination: vi.fn(),
  resetFederationConnection: vi.fn(),
  listAuditEvents: vi.fn(),
  getSamlConfig: vi.fn(),
  updateSamlConfig: vi.fn(),
  listFeatureFlags: vi.fn(),
  getFeatureFlag: vi.fn(),
  setFeatureFlag: vi.fn(),
  updateFeatureFlag: vi.fn(),
  deleteFeatureFlag: vi.fn(),
  listBackups: vi.fn(),
  getAuditEvent: vi.fn(),
  listSamlMappings: vi.fn(),
  getSamlMapping: vi.fn(),
  updateSamlMapping: vi.fn(),
  deleteSamlMapping: vi.fn(),
  samlLogout: vi.fn(),
  listSecurityEvents: vi.fn(),
  listIpBlocks: vi.fn(),
  blockIp: vi.fn(),
  unblockIp: vi.fn(),
  getIpReputation: vi.fn()
})

describe('AdminSecurityService', () => {
  let admin: ReturnType<typeof makeAdmin>
  let service: AdminSecurityService

  beforeEach(() => {
    admin = makeAdmin()
    service = new AdminSecurityService(async () => admin)
  })

  it('maps federation destinations into facade shape', async () => {
    admin.getFederationDestinations.mockResolvedValueOnce([
      {
        destination: 'server.com',
        retry_last_ts: 1,
        retry_interval: 2,
        failure_ts: 3,
        last_successful_stream_ordering: 4
      }
    ])

    await expect(service.getFederationDestinations()).resolves.toEqual([
      {
        destination: 'server.com',
        retryLastTs: 1,
        retryInterval: 2,
        failureTs: 3,
        lastSuccessfulStreamOrdering: 4
      }
    ])
  })

  it('maps audit log query and response', async () => {
    admin.listAuditEvents.mockResolvedValueOnce({
      events: [{ event_id: '$e1' }],
      next_batch: 'next'
    })

    const result = await service.getAuditLog(25, '1700000000', '@u:server', 'login')

    expect(admin.listAuditEvents).toHaveBeenCalledWith({
      limit: 25,
      from: 1700000000,
      actor_id: '@u:server',
      action: 'login'
    })
    expect(result).toEqual({
      logs: [{ event_id: '$e1' }],
      next_batch: 'next'
    })
  })

  it('normalizes experimental features from feature flag list response', async () => {
    admin.listFeatureFlags.mockResolvedValueOnce({
      flags: [
        { flag_key: 'mscA', status: 'enabled', reason: 'for testing', rollout_percent: 100, target_scope: 'global' },
        { flag_key: 'mscB', status: 'disabled', rollout_percent: 0, target_scope: 'user' }
      ]
    })

    await expect(service.getExperimentalFeatures()).resolves.toEqual({
      mscA: expect.objectContaining({
        enabled: true,
        status: 'enabled',
        reason: 'for testing',
        rolloutPercent: 100,
        targetScope: 'global'
      }),
      mscB: expect.objectContaining({
        enabled: false,
        status: 'disabled',
        rolloutPercent: 0,
        targetScope: 'user'
      })
    })
  })

  it('lists feature flags with detailed fields', async () => {
    admin.listFeatureFlags.mockResolvedValueOnce({
      flags: [
        {
          flag_key: 'flag-x',
          status: 'enabled',
          target_scope: 'global',
          rollout_percent: 80,
          expires_at: null,
          reason: 'rollout',
          created_by: '@admin:server',
          created_ts: 1,
          updated_ts: 2,
          targets: [{ subject_type: 'user', subject_id: '@alice:server' }]
        }
      ]
    })

    await expect(service.listFeatureFlagsDetailed()).resolves.toEqual([
      {
        flagKey: 'flag-x',
        enabled: true,
        status: 'enabled',
        description: 'rollout',
        targetScope: 'global',
        rolloutPercent: 80,
        expiresAt: null,
        reason: 'rollout',
        createdBy: '@admin:server',
        createdTs: 1,
        updatedTs: 2,
        targets: [{ subjectType: 'user', subjectId: '@alice:server' }]
      }
    ])
  })

  it('gets, saves and deletes feature flag detail', async () => {
    admin.getFeatureFlag.mockResolvedValueOnce({
      flag_key: 'flag-y',
      status: 'disabled',
      target_scope: 'global',
      rollout_percent: 0,
      expires_at: null,
      reason: 'hold',
      created_by: '@admin:server',
      created_ts: 3,
      updated_ts: 4,
      targets: []
    })
    admin.setFeatureFlag.mockResolvedValueOnce({
      flag_key: 'flag-y',
      status: 'enabled',
      target_scope: 'global',
      rollout_percent: 50,
      expires_at: 123,
      reason: 'gradual',
      created_by: '@admin:server',
      created_ts: 3,
      updated_ts: 5,
      targets: [{ subject_type: 'user', subject_id: '@bob:server' }]
    })
    admin.deleteFeatureFlag.mockResolvedValueOnce(undefined)

    await expect(service.getFeatureFlagDetail('flag-y')).resolves.toEqual(
      expect.objectContaining({
        flagKey: 'flag-y',
        status: 'disabled'
      })
    )

    await expect(
      service.saveFeatureFlag({
        flagKey: 'flag-y',
        targetScope: 'global',
        rolloutPercent: 50,
        expiresAt: 123,
        reason: 'gradual',
        targets: [{ subjectType: 'user', subjectId: '@bob:server' }]
      })
    ).resolves.toEqual(
      expect.objectContaining({
        flagKey: 'flag-y',
        enabled: true,
        rolloutPercent: 50
      })
    )
    expect(admin.setFeatureFlag).toHaveBeenCalledWith('flag-y', 'global', 50, 123, 'gradual', [
      { subject_type: 'user', subject_id: '@bob:server' }
    ])

    await service.deleteFeatureFlag('flag-y')
    expect(admin.deleteFeatureFlag).toHaveBeenCalledWith('flag-y')
  })

  it('sets experimental feature via updateFeatureFlag', async () => {
    admin.updateFeatureFlag.mockResolvedValueOnce(undefined)

    await service.setExperimentalFeature('msc1234', true)

    expect(admin.updateFeatureFlag).toHaveBeenCalledWith('msc1234', { status: 'enabled' })
  })

  it('delegates federation server status with throwOnError false', async () => {
    admin.getFederationDestination.mockResolvedValueOnce({ online: true })

    await expect(service.getFederationServerStatus('server.com')).resolves.toEqual({ online: true })
    expect(admin.getFederationDestination).toHaveBeenCalledWith('server.com', false)
  })

  it('maps saml mappings pagination response', async () => {
    admin.listSamlMappings.mockResolvedValueOnce({
      mappings: [{ name_id: 'n1' }],
      next_token: 'tok'
    })

    await expect(service.getSamlMappings(10, 'from')).resolves.toEqual({
      mappings: [{ name_id: 'n1' }],
      nextToken: 'tok'
    })
  })

  it('merges security filters and pagination', async () => {
    admin.listSecurityEvents.mockResolvedValueOnce({
      events: [{ id: 1 }],
      next_token: 'n1'
    })

    const result = await service.getSecurityEvents(50, 'from', { event_type: 'login_fail' })

    expect(admin.listSecurityEvents).toHaveBeenCalledWith({
      limit: 50,
      from: 'from',
      event_type: 'login_fail'
    })
    expect(result).toEqual({
      events: [{ id: 1 }],
      nextToken: 'n1'
    })
  })

  it('maps blockIp options to SDK snake_case fields', async () => {
    admin.blockIp.mockResolvedValueOnce({ ip: '1.2.3.4' })

    await expect(service.blockIp('1.2.3.4', { cidr: 24, expireAt: 999, reason: 'abuse' })).resolves.toEqual({
      ip: '1.2.3.4'
    })
    expect(admin.blockIp).toHaveBeenCalledWith('1.2.3.4', {
      cidr: 24,
      expire_at: 999,
      reason: 'abuse'
    })
  })
})
