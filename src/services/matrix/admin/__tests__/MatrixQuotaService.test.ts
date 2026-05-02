import type { MatrixClient } from 'matrix-js-sdk'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@tauri-apps/plugin-log', () => ({
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn()
}))

vi.mock('../../MatrixClientService', () => ({
  default: {
    getClient: vi.fn(() => null)
  }
}))

const mockQuotaManager = {
  checkQuota: vi.fn(),
  getQuotaStats: vi.fn(),
  getUploadSizeLimit: vi.fn(),
  getUploadFileSizeLimit: vi.fn(),
  getUserStorageUsage: vi.fn(),
  hasStorageSpace: vi.fn(),
  getQuotaAlerts: vi.fn(),
  getQuotaConfigs: vi.fn(),
  setUserQuota: vi.fn(),
  getServerQuota: vi.fn()
}

const mockClient = {
  getMediaQuotaManager: vi.fn(() => mockQuotaManager)
}

const { default: matrixClientService } = await import('../../MatrixClientService')
const { matrixQuotaService } = await import('../MatrixQuotaService')

describe('MatrixQuotaService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(matrixClientService.getClient).mockReturnValue(mockClient as unknown as MatrixClient)
    mockClient.getMediaQuotaManager.mockReturnValue(mockQuotaManager)
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  it('should get upload size limit from quota manager', async () => {
    mockQuotaManager.getUploadSizeLimit.mockResolvedValueOnce(2048)

    const result = await matrixQuotaService.getUploadSizeLimit()

    expect(result).toBe(2048)
    expect(mockQuotaManager.getUploadSizeLimit).toHaveBeenCalledWith(true)
  })

  it('should get upload file size limit from quota manager', async () => {
    mockQuotaManager.getUploadFileSizeLimit.mockResolvedValueOnce(4096)

    const result = await matrixQuotaService.getUploadFileSizeLimit()

    expect(result).toBe(4096)
    expect(mockQuotaManager.getUploadFileSizeLimit).toHaveBeenCalledWith(true)
  })

  it('should get user storage usage from quota manager', async () => {
    mockQuotaManager.getUserStorageUsage.mockResolvedValueOnce({
      size: 512,
      ntFiles: 4
    })

    const result = await matrixQuotaService.getUserStorageUsage()

    expect(result).toEqual({
      size: 512,
      ntFiles: 4
    })
    expect(mockQuotaManager.getUserStorageUsage).toHaveBeenCalledWith(true)
  })

  it('should return null when user storage usage falls back', async () => {
    vi.mocked(matrixClientService.getClient).mockReturnValue(null)

    await expect(matrixQuotaService.getUserStorageUsage(false)).resolves.toBeNull()
  })

  it('should return true when storage check falls back', async () => {
    vi.mocked(matrixClientService.getClient).mockReturnValue(null)

    await expect(matrixQuotaService.hasStorageSpace(1024)).resolves.toBe(true)
  })
})
