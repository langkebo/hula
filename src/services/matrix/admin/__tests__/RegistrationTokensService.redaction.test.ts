import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AdminManager } from '@/services/matrix/sdk'

// P0-2 regression guard: registration tokens are bearer credentials and must
// never appear verbatim in logs. Only a length + non-reversible fingerprint may
// be emitted. This suite captures the logger surface directly so it can assert
// on the exact strings handed to the logging sink.
const { infoSpy, errorSpy } = vi.hoisted(() => ({
  infoSpy: vi.fn(),
  errorSpy: vi.fn()
}))

vi.mock('@/utils/Logger', () => ({
  createLogger: () => ({
    info: infoSpy,
    error: errorSpy,
    warn: vi.fn(),
    debug: vi.fn(),
    trace: vi.fn()
  })
}))

const { AdminRegistrationTokensService } = await import('../RegistrationTokensService')

const SECRET = 'syt_super_secret_registration_token_1234567890'

const makeAdmin = () => ({
  getRegistrationTokens: vi.fn(),
  createRegistrationToken: vi.fn(),
  updateRegistrationToken: vi.fn(),
  deleteRegistrationToken: vi.fn()
})

function loggedText(): string {
  return infoSpy.mock.calls.map((call) => String(call[0])).join('\n')
}

describe('AdminRegistrationTokensService — token redaction (P0-2)', () => {
  let admin: ReturnType<typeof makeAdmin>
  let service: InstanceType<typeof AdminRegistrationTokensService>

  beforeEach(() => {
    infoSpy.mockClear()
    errorSpy.mockClear()
    admin = makeAdmin()
    service = new AdminRegistrationTokensService(async () => admin as unknown as AdminManager)
  })

  it('update never writes the raw token to logs', async () => {
    admin.updateRegistrationToken.mockResolvedValueOnce(undefined)
    admin.getRegistrationTokens.mockResolvedValueOnce({ registration_tokens: [] })

    await service.update(SECRET, { usesAllowed: 1 })

    const text = loggedText()
    expect(text).not.toContain(SECRET)
    expect(text).toContain(`长度=${SECRET.length}`)
  })

  it('delete never writes the raw token to logs', async () => {
    admin.deleteRegistrationToken.mockResolvedValueOnce(undefined)

    await service.delete(SECRET)

    const text = loggedText()
    expect(text).not.toContain(SECRET)
    expect(text).toContain(`长度=${SECRET.length}`)
  })

  it('emits a stable 8-hex fingerprint that is not a substring of the token', async () => {
    admin.deleteRegistrationToken.mockResolvedValue(undefined)

    await service.delete(SECRET)
    await service.delete(SECRET)

    const fingerprints = infoSpy.mock.calls
      .map((call) => /指纹=([0-9a-f]+)/.exec(String(call[0]))?.[1])
      .filter((value): value is string => Boolean(value))

    expect(fingerprints).toHaveLength(2)
    expect(fingerprints[0]).toBe(fingerprints[1])
    expect(fingerprints[0]).toMatch(/^[0-9a-f]{8}$/)
    expect(SECRET).not.toContain(fingerprints[0])
  })
})
