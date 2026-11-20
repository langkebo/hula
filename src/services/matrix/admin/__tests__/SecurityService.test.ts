import type { AdminManager } from 'matrix-js-sdk/admin'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  AuditEventFixture,
  AuditEventPageFixture,
  FeatureFlagFixture,
  FeatureFlagPageFixture
} from '@/services/matrix/__tests__/fixtures/generated'
import {
  makeFeatureFlag,
  makeFeatureFlagPage,
  makeFederationDestination,
  makeIpBlock,
  makeSamlMapping,
  makeSamlMappingPage,
  makeSecurityEvent,
  makeSecurityEventsPage
} from '@/services/matrix/admin/__tests__/fixtures/security'
import { AdminSecurityService } from '../SecurityService'

vi.mock('@tauri-apps/plugin-log', () => ({
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn()
}))

const makeAdmin = () =>
  ({
    getFederationDestinations: vi.fn(),
    getFederationDestination: vi.fn(),
    resetFederationConnection: vi.fn(),
    listAuditEvents: vi.fn(),
    listFeatureFlags: vi.fn(),
    getFeatureFlag: vi.fn(),
    setFeatureFlag: vi.fn(),
    updateFeatureFlag: vi.fn(),
    deleteFeatureFlag: vi.fn(),
    getAuditEvent: vi.fn(),
    listSamlMappings: vi.fn(),
    listSecurityEvents: vi.fn(),
    blockIp: vi.fn(),
    unblockIp: vi.fn(),
    listIpBlocks: vi.fn(),
    getIpReputation: vi.fn(),
    getSamlConfig: vi.fn(),
    getSamlMetadata: vi.fn(),
    getSpMetadata: vi.fn(),
    updateSamlConfig: vi.fn(),
    refreshIdpMetadata: vi.fn(),
    getSamlMapping: vi.fn(),
    updateSamlMapping: vi.fn(),
    deleteSamlMapping: vi.fn(),
    samlLogout: vi.fn()
  }) as unknown as AdminManager

describe('AdminSecurityService', () => {
  let admin: ReturnType<typeof makeAdmin>
  let service: AdminSecurityService

  beforeEach(() => {
    admin = makeAdmin()
    service = new AdminSecurityService(async () => admin)
  })

  it('maps federation destinations into facade shape', async () => {
    // SDK `FederationDestination` 的时间戳键是 `last_successful_ts`
    // （`admin-federation-types.d.ts:40`）；不存在 `last_successful_stream_ordering`。
    ;(admin as any).getFederationDestinations.mockResolvedValueOnce([
      {
        destination: 'server.com',
        retry_last_ts: 1,
        retry_interval: 2,
        failure_ts: 3,
        last_successful_ts: 4
      }
    ])

    await expect(service.getFederationDestinations()).resolves.toEqual([
      {
        destination: 'server.com',
        retryLastTs: 1,
        retryInterval: 2,
        failureTs: 3,
        lastSuccessfulTs: 4
      }
    ])
  })

  it('maps audit log query and response', async () => {
    // 游标键是 `next_batch`（SDK `AuditEventPage{events, total, next_batch}`）。
    // 用 codegen 夹具（结构真值来自 SDK 的 AuditEventPage），只覆盖测试关心的字段
    ;(admin as any).listAuditEvents.mockResolvedValueOnce({
      ...AuditEventPageFixture,
      events: [{ ...AuditEventFixture, event_id: '$e1' }],
      total: 1,
      next_batch: 'next'
    })

    const result = await service.getAuditLog(25, '1700000000', '@u:server', 'login')

    expect((admin as any).listAuditEvents).toHaveBeenCalledWith({
      limit: 25,
      from: 1700000000,
      actor_id: '@u:server',
      action: 'login'
    })
    // getAuditLog 原样透传（unknownToObject），所以断言就是同一份夹具 ——
    // 此前只写 { event_id } 一个键，掩盖了其余字段是否真的透传
    expect(result).toEqual({
      logs: [{ ...AuditEventFixture, event_id: '$e1' }],
      next_batch: 'next'
    })
  })

  it('normalizes experimental features from feature flag list response', async () => {
    // 用 FeatureFlagPage 夹具展开，只覆盖本用例关心的字段
    ;(admin as any).listFeatureFlags.mockResolvedValueOnce({
      ...FeatureFlagPageFixture,
      flags: [
        {
          ...FeatureFlagFixture,
          flag_key: 'mscA',
          status: 'enabled',
          reason: 'for testing',
          rollout_percent: 100,
          target_scope: 'global'
        },
        {
          ...FeatureFlagFixture,
          flag_key: 'mscB',
          status: 'disabled',
          rollout_percent: 0,
          target_scope: 'user'
        }
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
    // FeatureFlagPage 必填 `total`（旧 mock 漏了它）
    ;(admin as any).listFeatureFlags.mockResolvedValueOnce(
      makeFeatureFlagPage([
        makeFeatureFlag({
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
        })
      ])
    )

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
    ;(admin as any).getFeatureFlag.mockResolvedValueOnce(
      makeFeatureFlag({
        flag_key: 'flag-y',
        status: 'disabled',
        target_scope: 'global',
        rollout_percent: 0,
        expires_at: null,
        reason: 'hold',
        created_by: '@admin:server',
        created_ts: 3,
        updated_ts: 4
      })
    )
    ;(admin as any).setFeatureFlag.mockResolvedValueOnce(
      makeFeatureFlag({
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
    )
    ;(admin as any).deleteFeatureFlag.mockResolvedValueOnce(undefined)

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
    expect((admin as any).setFeatureFlag).toHaveBeenCalledWith('flag-y', 'global', 50, 123, 'gradual', [
      { subject_type: 'user', subject_id: '@bob:server' }
    ])

    await service.deleteFeatureFlag('flag-y')
    expect((admin as any).deleteFeatureFlag).toHaveBeenCalledWith('flag-y')
  })

  it('sets experimental feature via updateFeatureFlag', async () => {
    ;(admin as any).updateFeatureFlag.mockResolvedValueOnce(undefined)

    await service.setExperimentalFeature('msc1234', true)

    expect((admin as any).updateFeatureFlag).toHaveBeenCalledWith('msc1234', { status: 'enabled' })
  })

  it('delegates federation server status with throwOnError false', async () => {
    // 该端点返回的是完整 `FederationDestination`（旧 mock 的 `{ online: true }` 不是真实线格式）
    const destination = makeFederationDestination({ destination: 'server.com' })
    ;(admin as any).getFederationDestination.mockResolvedValueOnce(destination)

    await expect(service.getFederationServerStatus('server.com')).resolves.toEqual(destination)
    expect((admin as any).getFederationDestination).toHaveBeenCalledWith('server.com', false)
  })

  it('maps saml mappings pagination response', async () => {
    const mapping = makeSamlMapping('n1')
    ;(admin as any).listSamlMappings.mockResolvedValueOnce(makeSamlMappingPage([mapping], 'tok'))

    await expect(service.getSamlMappings(10, 'from')).resolves.toEqual({
      mappings: [mapping],
      nextToken: 'tok'
    })
  })

  it('merges security filters and pagination', async () => {
    // 安全事件的键是 `event_id/event_type/user_id/ts`（旧 mock 用的 `{ id: 1 }` 不是真实线格式）
    const event = makeSecurityEvent({ event_id: '$e1', event_type: 'login_fail' })
    ;(admin as any).listSecurityEvents.mockResolvedValueOnce(makeSecurityEventsPage([event], 'n1'))

    const result = await service.getSecurityEvents(50, 'from', { event_type: 'login_fail' })

    expect((admin as any).listSecurityEvents).toHaveBeenCalledWith({
      limit: 50,
      from: 'from',
      event_type: 'login_fail'
    })
    expect(result).toEqual({
      events: [event],
      nextToken: 'n1'
    })
  })

  it('maps blockIp options to SDK snake_case fields', async () => {
    const block = makeIpBlock({ ip: '1.2.3.4' })
    ;(admin as any).blockIp.mockResolvedValueOnce(block)

    await expect(service.blockIp('1.2.3.4', { cidr: 24, expireAt: 999, reason: 'abuse' })).resolves.toEqual(block)
    expect((admin as any).blockIp).toHaveBeenCalledWith('1.2.3.4', {
      cidr: 24,
      expire_at: 999,
      reason: 'abuse'
    })
  })
})
