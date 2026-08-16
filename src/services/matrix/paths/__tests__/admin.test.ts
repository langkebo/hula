import { describe, expect, it } from 'vitest'
import { ADMIN } from '../admin'

describe('ADMIN', () => {
  it('constant base paths', () => {
    expect(ADMIN.SYNAPSE_ADMIN_BASE).toBe('/_synapse/admin/v1')
    expect(ADMIN.SYNAPSE_ADMIN_BASE_V2).toBe('/_synapse/admin/v2')
    expect(ADMIN.USERS).toBe('/_synapse/admin/v2/users')
    expect(ADMIN.ROOMS).toBe('/_synapse/admin/v1/rooms')
    expect(ADMIN.EXTERNAL_SERVICES).toBe('/_synapse/admin/v1/external_services')
    expect(ADMIN.REPORTS).toBe('/_synapse/admin/v1/reports')
    expect(ADMIN.APPSERVICES).toBe('/_synapse/admin/v1/appservices')
  })

  it('WHOIS encodes userId', () => {
    expect(ADMIN.WHOIS('@u:server')).toBe('/_synapse/admin/v1/whois/%40u%3Aserver')
  })

  it('external services relative sub-paths', () => {
    expect(ADMIN.EXTERNAL_SERVICES_LIST).toBe('/external_services')
    expect(ADMIN.EXTERNAL_SERVICES_BY_ID('as1')).toBe('/external_services/as1')
    expect(ADMIN.EXTERNAL_SERVICES_HEALTH).toBe('/external_services/health')
    expect(ADMIN.EXTERNAL_SERVICES_HEALTH_BY_ID('as1')).toBe('/external_services/as1/health')
    expect(ADMIN.EXTERNAL_SERVICES_HEALTH_CHECK('as1')).toBe('/external_services/as1/health/check')
  })

  it('report and appservice parameterized paths', () => {
    expect(ADMIN.REPORT_BY_ID('r1')).toBe('/_synapse/admin/v1/reports/r1')
    expect(ADMIN.APPSERVICE_BY_ID('id')).toBe('/_synapse/admin/v1/appservices/id')
  })
})
