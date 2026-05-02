import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAdminRegistrationTokens } from '../useAdminRegistrationTokens'

vi.mock('@/services/matrix/admin', () => ({
  adminService: {
    getRegistrationTokens: vi.fn().mockResolvedValue([]),
    createRegistrationToken: vi.fn().mockResolvedValue({ token: 'new', pending: 0, completed: 0 }),
    updateRegistrationToken: vi.fn().mockResolvedValue(null),
    deleteRegistrationToken: vi.fn().mockResolvedValue(undefined)
  }
}))

import { adminService } from '@/services/matrix/admin'

describe('useAdminRegistrationTokens', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('loadTokens populates ref', async () => {
    vi.mocked(adminService.getRegistrationTokens).mockResolvedValueOnce([
      { token: 'a', pending: 1, completed: 0 },
      { token: 'b', pending: 0, completed: 2 }
    ])
    const c = useAdminRegistrationTokens()
    await c.loadTokens()
    expect(c.tokens.value).toHaveLength(2)
  })

  it('createToken reloads on success', async () => {
    const c = useAdminRegistrationTokens()
    const result = await c.createToken({ usesAllowed: 5 })
    expect(result?.token).toBe('new')
    expect(adminService.createRegistrationToken).toHaveBeenCalledWith({ usesAllowed: 5 })
    expect(adminService.getRegistrationTokens).toHaveBeenCalledTimes(1)
  })

  it('createToken does not reload on null result', async () => {
    vi.mocked(adminService.createRegistrationToken).mockResolvedValueOnce(null)
    const c = useAdminRegistrationTokens()
    const result = await c.createToken()
    expect(result).toBeNull()
    expect(adminService.getRegistrationTokens).not.toHaveBeenCalled()
  })

  it('creating flag toggles around createToken', async () => {
    const c = useAdminRegistrationTokens()
    const p = c.createToken({ usesAllowed: 1 })
    expect(c.creating.value).toBe(true)
    await p
    expect(c.creating.value).toBe(false)
  })

  it('updateToken reloads list', async () => {
    const c = useAdminRegistrationTokens()
    await c.updateToken('a', { usesAllowed: 10 })
    expect(adminService.updateRegistrationToken).toHaveBeenCalledWith('a', { usesAllowed: 10 })
    expect(adminService.getRegistrationTokens).toHaveBeenCalledTimes(1)
  })

  it('deleteToken reloads list', async () => {
    const c = useAdminRegistrationTokens()
    await c.deleteToken('a')
    expect(adminService.deleteRegistrationToken).toHaveBeenCalledWith('a')
    expect(adminService.getRegistrationTokens).toHaveBeenCalledTimes(1)
  })
})
