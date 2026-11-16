import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  AccountDeactivationError,
  deactivationErrorKey,
  useAccountDeactivationFlow
} from '../useAccountDeactivationFlow'

const { verifyPasswordMock, deactivateAccountMock } = vi.hoisted(() => ({
  verifyPasswordMock: vi.fn(),
  deactivateAccountMock: vi.fn()
}))

vi.mock('@/services/matrix', () => ({
  matrixAccountService: {
    verifyPassword: verifyPasswordMock,
    deactivateAccount: deactivateAccountMock
  }
}))

vi.mock('@/utils/Logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  })
}))

describe('useAccountDeactivationFlow', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('verifies the password before deactivating with the same credentials', async () => {
    verifyPasswordMock.mockResolvedValue(true)
    deactivateAccountMock.mockResolvedValue(undefined)

    const { deactivateWithPassword } = useAccountDeactivationFlow()
    await deactivateWithPassword('@user:example.com', 'secret', true)

    expect(verifyPasswordMock).toHaveBeenCalledWith('secret')
    expect(deactivateAccountMock).toHaveBeenCalledWith(
      {
        type: 'm.login.password',
        identifier: { type: 'm.id.user', user: '@user:example.com' },
        password: 'secret'
      },
      true
    )
  })

  it('rejects with password_invalid and skips deactivation when the password is wrong', async () => {
    verifyPasswordMock.mockResolvedValue(false)

    const { deactivateWithPassword } = useAccountDeactivationFlow()

    await expect(deactivateWithPassword('@user:example.com', 'wrong')).rejects.toMatchObject({
      code: 'password_invalid'
    })
    expect(deactivateAccountMock).not.toHaveBeenCalled()
  })

  it('treats verification request errors as password_invalid', async () => {
    verifyPasswordMock.mockRejectedValue(new Error('network'))

    const { deactivateWithPassword } = useAccountDeactivationFlow()

    await expect(deactivateWithPassword('@user:example.com', 'secret')).rejects.toMatchObject({
      code: 'password_invalid'
    })
    expect(deactivateAccountMock).not.toHaveBeenCalled()
  })

  it('wraps deactivation failures into a failed error', async () => {
    verifyPasswordMock.mockResolvedValue(true)
    deactivateAccountMock.mockRejectedValue(new Error('server down'))

    const { deactivateWithPassword } = useAccountDeactivationFlow()

    await expect(deactivateWithPassword('@user:example.com', 'secret')).rejects.toMatchObject({ code: 'failed' })
  })

  it('deactivates with the current session when no auth data is provided', async () => {
    deactivateAccountMock.mockResolvedValue(undefined)

    const { deactivate } = useAccountDeactivationFlow()
    await deactivate()

    expect(deactivateAccountMock).toHaveBeenCalledWith(undefined, false)
  })

  it('maps failure codes to shared i18n keys', () => {
    expect(deactivationErrorKey(new AccountDeactivationError('password_invalid'))).toBe(
      'setting.account.deactivate_password_invalid'
    )
    expect(deactivationErrorKey(new AccountDeactivationError('failed'))).toBe('setting.account.deactivate_failed')
    expect(deactivationErrorKey(new Error('unknown'))).toBe('setting.account.deactivate_failed')
  })
})
