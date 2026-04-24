import { describe, it, expect, vi, beforeEach } from 'vitest'
import { adminService } from '../MatrixAdminService'

vi.mock('@tauri-apps/plugin-log', () => ({
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn()
}))

describe('MatrixAdminService Extended', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('adminGetSpaces', () => {
    it('returns empty spaces list under spy harness (SDK-gated)', async () => {
      // After Phase B Batch 7 migration, `adminGetSpaces` delegates to the SDK
      // `AdminManager.listSpaces`. Under this spy harness the private
      // `sdkAdmin()` gate fails (no real Matrix client), so the service falls
      // through its catch arm and returns the empty sentinel. The full-path
      // behavior is exercised in `MatrixAdminService.test.ts`.
      const result = await adminService.adminGetSpaces(20, 'from_token')
      expect(result.spaces).toEqual([])
    })

    it('should return empty spaces on error', async () => {
      const result = await adminService.adminGetSpaces()

      expect(result.spaces).toEqual([])
    })
  })

  describe('adminDeleteSpace', () => {
    it('SDK-gated delete throws under spy harness', async () => {
      await expect(adminService.adminDeleteSpace('!space:server')).rejects.toThrow()
    })
  })

  describe('shadowBan', () => {
    it('SDK-gated shadow ban throws under spy harness', async () => {
      // After Phase B Batch 10 migration, `shadowBan` delegates to SDK
      // `AdminManager.shadowBanUser` / `unshadowBanUser`. Under this spy
      // harness the private `sdkAdmin()` gate fails (no real Matrix client),
      // so the service falls through its catch arm and rethrows.
      await expect(adminService.shadowBan('@user:server', true)).rejects.toThrow()
    })

    it('SDK-gated unban throws under spy harness', async () => {
      await expect(adminService.shadowBan('@user:server', false)).rejects.toThrow()
    })
  })

  describe('getRateLimits', () => {
    it('returns empty object under spy harness (SDK-gated after Batch 10)', async () => {
      // After Phase B Batch 10, `getRateLimits` delegates to SDK
      // `AdminManager.getRateLimitOverride`. Under this spy harness the
      // private `sdkAdmin()` gate fails, so the service falls through its
      // catch arm and returns `{}`.
      const result = await adminService.getRateLimits('@user:server')
      expect(result).toEqual({})
    })

    it('should return empty object on error', async () => {
      const result = await adminService.getRateLimits('@user:server')
      expect(result).toEqual({})
    })
  })

  describe('setRateLimits', () => {
    it('SDK-gated setRateLimits throws under spy harness', async () => {
      const limits = { messages_per_second: 20 }
      await expect(adminService.setRateLimits('@user:server', limits)).rejects.toThrow()
    })
  })

  describe('getAuditLog', () => {
    it('returns empty logs when SDK call fails', async () => {
      // After Phase B Batch 5 migration, `getAuditLog` delegates to the SDK
      // `AdminManager.listAuditEvents`. Under this spy harness the private
      // `sdkAdmin()` gate fails (no real Matrix client), so the service falls
      // through its catch arm and returns the empty sentinel. That is the
      // contract we want to lock in here — the full-path parsing behavior is
      // covered in `MatrixAdminService.test.ts` where the SDK manager is
      // fully mocked.
      const result = await adminService.getAuditLog()
      expect(result.logs).toEqual([])
    })
  })

  describe('getSamlConfig', () => {
    it('returns empty object under spy harness (SDK-gated after Batch 9)', async () => {
      const result = await adminService.getSamlConfig()
      expect(result).toEqual({})
    })
  })

  describe('updateSamlConfig', () => {
    it('SDK-gated under spy harness throws', async () => {
      const config = { idp_id: 'saml2', sp_entity_id: 'sp2' }
      await expect(adminService.updateSamlConfig(config)).rejects.toThrow()
    })
  })
})
