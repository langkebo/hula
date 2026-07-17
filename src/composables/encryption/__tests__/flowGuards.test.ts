import { describe, expect, it, vi } from 'vitest'

const { cryptoMock, keyBackupMock, verificationMock } = vi.hoisted(() => ({
  cryptoMock: {
    setupKeyBackup: vi.fn(),
    createSecureBackup: vi.fn(),
    getCryptoStatus: vi.fn().mockResolvedValue({})
  },
  keyBackupMock: {
    checkKeyBackup: vi.fn().mockResolvedValue(null),
    verifyBackup: vi.fn(),
    restoreKeyBackup: vi.fn(),
    importKeys: vi.fn(),
    deleteKeyBackupVersion: vi.fn()
  },
  verificationMock: {
    getPendingVerifications: vi.fn().mockResolvedValue([]),
    startSasVerification: vi.fn(),
    acceptVerification: vi.fn(),
    confirmSas: vi.fn(),
    cancelVerification: vi.fn()
  }
}))

vi.mock('@/services/matrix/crypto/MatrixCryptoService', () => ({ default: cryptoMock }))
vi.mock('@/services/matrix/crypto/MatrixKeyBackupService', () => ({ matrixKeyBackupService: keyBackupMock }))
vi.mock('@/services/matrix/crypto/MatrixVerificationService', () => ({ matrixVerificationService: verificationMock }))
vi.mock('@/composables/common/useActionFeedback', () => ({
  useActionFeedback: () => ({ showFeedback: vi.fn() })
}))
vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }))

import { useKeyBackupFlow } from '../useKeyBackupFlow'

describe('encryption flow in-flight guard', () => {
  it('createBackup double-click only executes once', async () => {
    const resolvers: Array<() => void> = []
    cryptoMock.setupKeyBackup.mockImplementation(() => new Promise<void>((r) => resolvers.push(r)))
    const flow = useKeyBackupFlow()

    const first = flow.createBackup()
    const second = flow.createBackup()
    // resolve all pending promises so both calls can complete
    for (const resolve of resolvers) {
      resolve()
    }
    const [r1, r2] = await Promise.all([first, second])

    expect(cryptoMock.setupKeyBackup).toHaveBeenCalledTimes(1)
    expect(r1).toBe(true)
    expect(r2).toBe(false)
  })
})
