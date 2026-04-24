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
  getExperimentalFeatures: vi.fn(),
  updateFeatureFlag: vi.fn(),
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

  it('normalizes experimental features from enabled and disabled arrays', async () => {
    admin.getExperimentalFeatures.mockResolvedValueOnce({
      enabled: [{ flag_key: 'mscA' }],
      disabled: [{ key: 'mscB' }]
    })

    await expect(service.getExperimentalFeatures()).resolves.toEqual({
      mscA: true,
      mscB: false
    })
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
