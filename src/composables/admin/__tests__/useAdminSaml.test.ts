import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAdminSaml } from '../useAdminSaml'

vi.mock('@/services/matrix/admin', () => ({
  adminService: {
    security: {
      getSamlMetadata: vi.fn().mockResolvedValue({}),
      getSpMetadata: vi.fn().mockResolvedValue(''),
      refreshIdpMetadata: vi.fn().mockResolvedValue({}),
      getSamlMapping: vi.fn()
    }
  }
}))

import { adminService } from '@/services/matrix/admin'
import { makeSamlMapping, makeSamlMetadata } from './fixtures/admin'

describe('useAdminSaml', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('loadMetadata populates refs', async () => {
    vi.mocked(adminService.security.getSamlMetadata).mockResolvedValueOnce(makeSamlMetadata({ entity_id: 'saml1' }))
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

  it('loadMappingDetail 归一化服务端字段，未命中时返回 null', async () => {
    vi.mocked(adminService.security.getSamlMapping).mockResolvedValueOnce(
      makeSamlMapping({ name_id: 'alice@idp', user_id: '@alice:server', display_name: 'Alice' })
    )
    const c = useAdminSaml()
    await expect(c.loadMappingDetail('alice@idp')).resolves.toEqual({
      nameId: 'alice@idp',
      userId: '@alice:server',
      displayName: 'Alice',
      name_id: 'alice@idp',
      user_id: '@alice:server',
      display_name: 'Alice'
    })
    expect(adminService.security.getSamlMapping).toHaveBeenCalledWith('alice@idp')

    vi.mocked(adminService.security.getSamlMapping).mockResolvedValueOnce(null)
    await expect(c.loadMappingDetail('missing@idp')).resolves.toBeNull()
  })
})
