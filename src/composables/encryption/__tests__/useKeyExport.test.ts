import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useKeyExport } from '../useKeyExport'

const { exportKeysMock } = vi.hoisted(() => ({
  exportKeysMock: vi.fn()
}))

vi.mock('@/services/matrix/crypto/CryptoSDKAdapter', () => ({
  cryptoSDKAdapter: {
    exportKeys: (...args: unknown[]) => exportKeysMock(...args)
  }
}))

describe('useKeyExport', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
  })

  it('导出成功后返回 keys 并触发下载', async () => {
    exportKeysMock.mockResolvedValue({ data: '{"keys":[]}' })
    const { isExporting, exportKeys } = useKeyExport()

    const result = await exportKeys('tjg-keys-backup.json')

    expect(result).toBe('{"keys":[]}')
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1)
    expect(HTMLAnchorElement.prototype.click).toHaveBeenCalledTimes(1)
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock')
    expect(isExporting.value).toBe(false)
  })

  it('空内容不创建下载，返回空字符串', async () => {
    exportKeysMock.mockResolvedValue({ data: '' })
    const { exportKeys } = useKeyExport()

    await expect(exportKeys('tjg-keys.json')).resolves.toBe('')
    expect(URL.createObjectURL).not.toHaveBeenCalled()
    expect(HTMLAnchorElement.prototype.click).not.toHaveBeenCalled()
  })

  it('导出失败时复位 isExporting 并抛出', async () => {
    exportKeysMock.mockRejectedValue(new Error('boom'))
    const { isExporting, exportKeys } = useKeyExport()

    await expect(exportKeys('tjg-keys.json')).rejects.toThrow('boom')
    expect(isExporting.value).toBe(false)
  })
})
