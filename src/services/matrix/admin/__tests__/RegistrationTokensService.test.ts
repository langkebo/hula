import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@tauri-apps/plugin-log', () => ({
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn()
}))

const { AdminRegistrationTokensService } = await import('../RegistrationTokensService')

const makeAdmin = () => ({
  getRegistrationTokens: vi.fn(),
  createRegistrationToken: vi.fn(),
  updateRegistrationToken: vi.fn(),
  deleteRegistrationToken: vi.fn()
})

describe('AdminRegistrationTokensService', () => {
  let admin: ReturnType<typeof makeAdmin>
  let service: InstanceType<typeof AdminRegistrationTokensService>

  beforeEach(() => {
    admin = makeAdmin()
    service = new AdminRegistrationTokensService(async () => admin)
  })

  it('list maps SDK snake_case to domain camelCase', async () => {
    admin.getRegistrationTokens.mockResolvedValueOnce([
      { token: 't1', uses_allowed: 5, pending: 1, completed: 2, expiry_ts: 1700000000 },
      { token: 't2' }
    ])
    const result = await service.list()
    expect(result).toEqual([
      { token: 't1', usesAllowed: 5, pending: 1, completed: 2, expiryTime: 1700000000 },
      { token: 't2', usesAllowed: undefined, pending: 0, completed: 0, expiryTime: undefined }
    ])
  })

  it('list returns [] on error', async () => {
    admin.getRegistrationTokens.mockRejectedValueOnce(new Error('boom'))
    expect(await service.list()).toEqual([])
  })

  it('get returns the matching token from list', async () => {
    admin.getRegistrationTokens.mockResolvedValueOnce([{ token: 't1' }, { token: 't2' }])
    const result = await service.get('t2')
    expect(result?.token).toBe('t2')
  })

  it('get returns null when missing', async () => {
    admin.getRegistrationTokens.mockResolvedValueOnce([])
    expect(await service.get('tX')).toBeNull()
  })

  it('create sends camelCase -> snake_case body and maps response', async () => {
    admin.createRegistrationToken.mockResolvedValueOnce({
      token: 'new',
      uses_allowed: 3,
      pending: 0,
      completed: 0,
      expiry_ts: 123
    })
    const result = await service.create({ token: 'new', usesAllowed: 3, expiryTime: 123 })
    expect(admin.createRegistrationToken).toHaveBeenCalledWith({
      token: 'new',
      uses_allowed: 3,
      expiry_ts: 123
    })
    expect(result).toEqual({
      token: 'new',
      usesAllowed: 3,
      pending: 0,
      completed: 0,
      expiryTime: 123
    })
  })

  it('create omits undefined fields from the body', async () => {
    admin.createRegistrationToken.mockResolvedValueOnce({ token: 'auto' })
    await service.create()
    expect(admin.createRegistrationToken).toHaveBeenCalledWith({})
  })

  it('create returns null on backend error', async () => {
    admin.createRegistrationToken.mockRejectedValueOnce(new Error('forbidden'))
    expect(await service.create({ token: 'x' })).toBeNull()
  })

  it('update passes snake_case body and refreshes via list', async () => {
    admin.updateRegistrationToken.mockResolvedValueOnce(undefined)
    admin.getRegistrationTokens.mockResolvedValueOnce([{ token: 't1', uses_allowed: 9 }])
    const result = await service.update('t1', { usesAllowed: 9 })
    expect(admin.updateRegistrationToken).toHaveBeenCalledWith('t1', { uses_allowed: 9 })
    expect(result?.usesAllowed).toBe(9)
  })

  it('update returns null on backend error', async () => {
    admin.updateRegistrationToken.mockRejectedValueOnce(new Error('conflict'))
    expect(await service.update('t1', {})).toBeNull()
  })

  it('delete forwards the token and rethrows on failure', async () => {
    admin.deleteRegistrationToken.mockResolvedValueOnce(undefined)
    await service.delete('t1')
    expect(admin.deleteRegistrationToken).toHaveBeenCalledWith('t1')

    admin.deleteRegistrationToken.mockRejectedValueOnce(new Error('500'))
    await expect(service.delete('t1')).rejects.toThrow('500')
  })
})
