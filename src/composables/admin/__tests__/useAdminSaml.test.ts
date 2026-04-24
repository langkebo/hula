import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useAdminSaml } from '../useAdminSaml'

vi.mock('@/services/matrix', () => ({
  adminService: {
    getSamlConfig: vi.fn().mockResolvedValue({}),
    updateSamlConfig: vi.fn().mockResolvedValue(undefined)
  }
}))

import { adminService } from '@/services/matrix'

describe('useAdminSaml', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('loadConfig populates ref', async () => {
    vi.mocked(adminService.getSamlConfig).mockResolvedValueOnce({ idp_id: 'saml1' })
    const c = useAdminSaml()
    await c.loadConfig()
    expect(c.config.value).toEqual({ idp_id: 'saml1' })
  })

  it('loading flag toggles around loadConfig', async () => {
    const c = useAdminSaml()
    const p = c.loadConfig()
    expect(c.loading.value).toBe(true)
    await p
    expect(c.loading.value).toBe(false)
  })

  it('updateConfig calls service and reloads', async () => {
    const c = useAdminSaml()
    await c.updateConfig({ sp_entity_id: 'sp1' })
    expect(adminService.updateSamlConfig).toHaveBeenCalledWith({ sp_entity_id: 'sp1' })
    expect(adminService.getSamlConfig).toHaveBeenCalledTimes(1)
  })

  it('saving flag toggles around updateConfig', async () => {
    const c = useAdminSaml()
    const p = c.updateConfig({})
    expect(c.saving.value).toBe(true)
    await p
    expect(c.saving.value).toBe(false)
  })
})
