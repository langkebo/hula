import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/services/matrix/MatrixClientService', () => ({
  matrixClientService: { getRoom: vi.fn() }
}))
vi.mock('@/services/matrix/crypto/CryptoSDKAdapter', () => ({
  cryptoSDKAdapter: { getDevices: vi.fn() }
}))
vi.mock('@/services/matrix/crypto/MatrixCryptoService', () => ({
  matrixCryptoService: { getDeviceVerificationStatus: vi.fn() }
}))

import { cryptoSDKAdapter } from '@/services/matrix/crypto/CryptoSDKAdapter'
import { matrixCryptoService } from '@/services/matrix/crypto/MatrixCryptoService'
import { matrixClientService } from '@/services/matrix/MatrixClientService'
import { useDeviceTrust } from '../useDeviceTrust'

const mockGetRoom = vi.mocked(matrixClientService.getRoom)
const mockGetDevices = vi.mocked(cryptoSDKAdapter.getDevices)
const mockGetStatus = vi.mocked(matrixCryptoService.getDeviceVerificationStatus)

const makeRoom = (userIds: string[]) => ({
  getJoinedMembers: vi.fn().mockReturnValue(new Map(userIds.map((id) => [id, { userId: id }])))
})

describe('useDeviceTrust.loadUnverifiedDevicesInRoom', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('collects only unverified (non-cross-signed) devices across room members', async () => {
    mockGetRoom.mockReturnValue(makeRoom(['@alice:server', '@bob:server']) as never)

    mockGetDevices
      .mockResolvedValueOnce([
        {
          deviceId: 'aliceDev1',
          userId: '@alice:server',
          displayName: 'Alice Phone',
          lastSeenTs: 1,
          lastSeenIp: '1.1.1.1'
        }
      ])
      .mockResolvedValueOnce([
        { deviceId: 'bobDev1', userId: '@bob:server', displayName: 'Bob Laptop', lastSeenTs: 2, lastSeenIp: '2.2.2.2' },
        { deviceId: 'bobDev2', userId: '@bob:server', displayName: 'Bob Phone', lastSeenTs: 3, lastSeenIp: '2.2.2.3' }
      ])

    // aliceDev1 -> verified (skip); bobDev1 -> unverified; bobDev2 -> cross-signed (skip)
    mockGetStatus
      .mockResolvedValueOnce({ verified: true, crossSigningVerified: true, devicesCrossSigningVerified: true })
      .mockResolvedValueOnce({ verified: false, crossSigningVerified: false, devicesCrossSigningVerified: false })
      .mockResolvedValueOnce({ verified: false, crossSigningVerified: true, devicesCrossSigningVerified: true })

    const { unverifiedDevices, loadUnverifiedDevicesInRoom } = useDeviceTrust()
    await loadUnverifiedDevicesInRoom('!room:server')

    expect(unverifiedDevices.value).toHaveLength(1)
    expect(unverifiedDevices.value[0]).toMatchObject({ userId: '@bob:server', deviceId: 'bobDev1' })
  })

  it('returns empty when the room is not found', async () => {
    mockGetRoom.mockReturnValue(null)

    const { unverifiedDevices, loadUnverifiedDevicesInRoom } = useDeviceTrust()
    await loadUnverifiedDevicesInRoom('!missing:server')

    expect(unverifiedDevices.value).toEqual([])
    expect(mockGetDevices).not.toHaveBeenCalled()
  })

  it('skips a member whose device list fails to load without dropping others', async () => {
    mockGetRoom.mockReturnValue(makeRoom(['@alice:server', '@bob:server']) as never)
    mockGetDevices
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce([
        { deviceId: 'bobDev1', userId: '@bob:server', displayName: 'Bob', lastSeenTs: 2, lastSeenIp: '2.2.2.2' }
      ])
    mockGetStatus.mockResolvedValueOnce({
      verified: false,
      crossSigningVerified: false,
      devicesCrossSigningVerified: false
    })

    const { unverifiedDevices, loadUnverifiedDevicesInRoom } = useDeviceTrust()
    await loadUnverifiedDevicesInRoom('!room:server')

    expect(unverifiedDevices.value).toHaveLength(1)
    expect(unverifiedDevices.value[0].deviceId).toBe('bobDev1')
  })
})
