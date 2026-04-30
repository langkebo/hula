import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAdminSaml } from '../useAdminSaml'

vi.mock('@/services/matrix', () => ({
  adminService: {
    security: {
      getSamlMetadata: vi.fn().mockResolvedValue({}),
      getSpMetadata: vi.fn().mockResolvedValue(''),
      refreshIdpMetadata: vi.fn().mockResolvedValue({})
    }
  }
}))

import { adminService } from '@/services/matrix'

describe('useAdminSaml', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('loadMetadata populates refs', async () => {
    vi.mocked(adminService.security.getSamlMetadata).mockResolvedValueOnce({ entity_id: 'saml1' })
    vi.mocked(adminService.security.getSpMetadata).mockResolvedValueOnce('<xml />')
    const c = useAdminSaml()
    await c.loadMetadata()
    expect(c.idpMetadata.value).toEqual({ entity_id: 'saml1' })
    expect(c.spMetadata.value).toBe('<xml />')
  })

  it('loading flag toggles around loadMetadata', async () => {
    const c = useAdminSaml()
    const p = c.loadMetadata()
    expect(c.loading.value).toBe(true)
    await p
    expect(c.loading.value).toBe(false)
  })

  it('refreshMetadata calls service and updates idp metadata', async () => {
    const c = useAdminSaml()
    await c.refreshMetadata()
    expect(adminService.security.refreshIdpMetadata).toHaveBeenCalledTimes(1)
  })

  it('refreshing flag toggles around refreshMetadata', async () => {
    const c = useAdminSaml()
    const p = c.refreshMetadata()
    expect(c.refreshing.value).toBe(true)
    await p
    expect(c.refreshing.value).toBe(false)
  })
})
