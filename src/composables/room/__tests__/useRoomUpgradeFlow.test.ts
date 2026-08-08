import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockGetRoomVersion, mockGetCapabilities, mockUpgradeRoom, mockShowFeedback } = vi.hoisted(() => ({
  mockGetRoomVersion: vi.fn(),
  mockGetCapabilities: vi.fn(),
  mockUpgradeRoom: vi.fn(),
  mockShowFeedback: vi.fn()
}))

vi.mock('@/services/matrix/room/MetadataService', () => ({
  matrixRoomMetadataService: {
    getRoomVersion: mockGetRoomVersion
  }
}))

vi.mock('@/services/matrix/user/MatrixAccountService', () => ({
  matrixAccountService: {
    getCapabilities: mockGetCapabilities
  }
}))

vi.mock('@/services/matrix/room/RoomOperations', () => ({
  roomOperations: {
    upgradeRoom: mockUpgradeRoom
  }
}))

vi.mock('@/composables/common/useActionFeedback', () => ({
  useActionFeedback: () => ({
    showFeedback: mockShowFeedback
  })
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key
  })
}))

import { useRoomUpgradeFlow } from '../useRoomUpgradeFlow'

describe('useRoomUpgradeFlow', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('load', () => {
    it('loads current version and capabilities in parallel', async () => {
      mockGetRoomVersion.mockResolvedValueOnce('10')
      mockGetCapabilities.mockResolvedValueOnce({
        'm.room_versions': {
          default: '11',
          available: { '9': 'stable', '10': 'stable', '11': 'stable' }
        }
      })

      const flow = useRoomUpgradeFlow({ roomId: '!r:s' })
      await flow.load()

      expect(flow.currentVersion.value).toBe('10')
      expect(flow.defaultVersion.value).toBe('11')
      expect(flow.availableVersions.value).toHaveLength(3)
      expect(flow.availableVersions.value.map((v) => v.version)).toEqual(['9', '10', '11'])
      expect(flow.loading.value).toBe(false)
      expect(flow.errorMessage.value).toBeNull()
    })

    it('sorts versions numerically', async () => {
      mockGetRoomVersion.mockResolvedValueOnce('9')
      mockGetCapabilities.mockResolvedValueOnce({
        'm.room_versions': {
          default: '11',
          available: { '11': 'stable', '9': 'stable', '10': 'stable' }
        }
      })

      const flow = useRoomUpgradeFlow({ roomId: '!r:s' })
      await flow.load()

      expect(flow.availableVersions.value.map((v) => v.version)).toEqual(['9', '10', '11'])
    })

    it('skips loading when roomId is null', async () => {
      const flow = useRoomUpgradeFlow({ roomId: null })
      await flow.load()

      expect(mockGetRoomVersion).not.toHaveBeenCalled()
      expect(mockGetCapabilities).not.toHaveBeenCalled()
      expect(flow.currentVersion.value).toBeNull()
      expect(flow.availableVersions.value).toEqual([])
    })

    it('sets errorMessage when getRoomVersion throws', async () => {
      mockGetRoomVersion.mockRejectedValueOnce(new Error('network'))
      mockGetCapabilities.mockResolvedValueOnce({})

      const flow = useRoomUpgradeFlow({ roomId: '!r:s' })
      await flow.load()

      expect(flow.errorMessage.value).toBe('room_advanced.room_upgrade.failed')
      expect(flow.loading.value).toBe(false)
    })

    it('handles missing m.room_versions in capabilities', async () => {
      mockGetRoomVersion.mockResolvedValueOnce('10')
      mockGetCapabilities.mockResolvedValueOnce({})

      const flow = useRoomUpgradeFlow({ roomId: '!r:s' })
      await flow.load()

      expect(flow.currentVersion.value).toBe('10')
      expect(flow.availableVersions.value).toEqual([])
      expect(flow.defaultVersion.value).toBeNull()
    })

    it('handles room_versions alternative key', async () => {
      mockGetRoomVersion.mockResolvedValueOnce('10')
      mockGetCapabilities.mockResolvedValueOnce({
        room_versions: {
          default: '11',
          available: { '11': 'stable' }
        }
      })

      const flow = useRoomUpgradeFlow({ roomId: '!r:s' })
      await flow.load()

      expect(flow.defaultVersion.value).toBe('11')
      expect(flow.availableVersions.value).toHaveLength(1)
    })
  })

  describe('computed', () => {
    it('newerVersions filters versions greater than current', async () => {
      mockGetRoomVersion.mockResolvedValueOnce('10')
      mockGetCapabilities.mockResolvedValueOnce({
        'm.room_versions': {
          default: '11',
          available: { '9': 'stable', '10': 'stable', '11': 'stable' }
        }
      })

      const flow = useRoomUpgradeFlow({ roomId: '!r:s' })
      await flow.load()

      expect(flow.newerVersions.value.map((v) => v.version)).toEqual(['11'])
    })

    it('newerVersions returns all when no current version', async () => {
      mockGetRoomVersion.mockResolvedValueOnce(null)
      mockGetCapabilities.mockResolvedValueOnce({
        'm.room_versions': { default: '11', available: { '10': 'stable', '11': 'stable' } }
      })

      const flow = useRoomUpgradeFlow({ roomId: '!r:s' })
      await flow.load()

      expect(flow.newerVersions.value).toHaveLength(2)
    })

    it('canUpgrade defaults to true when roomId provided', () => {
      const flow = useRoomUpgradeFlow({ roomId: '!r:s' })
      expect(flow.canUpgrade.value).toBe(true)
    })

    it('canUpgrade is false when explicitly disabled', () => {
      const flow = useRoomUpgradeFlow({ roomId: '!r:s', canUpgrade: false })
      expect(flow.canUpgrade.value).toBe(false)
    })

    it('canUpgrade is false when roomId is null', () => {
      const flow = useRoomUpgradeFlow({ roomId: null })
      expect(flow.canUpgrade.value).toBe(false)
    })

    it('hasVersions reflects availableVersions', async () => {
      mockGetRoomVersion.mockResolvedValueOnce('10')
      mockGetCapabilities.mockResolvedValueOnce({
        'm.room_versions': { default: '11', available: { '11': 'stable' } }
      })

      const flow = useRoomUpgradeFlow({ roomId: '!r:s' })
      await flow.load()

      expect(flow.hasVersions.value).toBe(true)
    })
  })

  describe('resolveTargetVersion', () => {
    it('returns explicitly set targetVersion first', async () => {
      mockGetRoomVersion.mockResolvedValueOnce('10')
      mockGetCapabilities.mockResolvedValueOnce({
        'm.room_versions': { default: '11', available: { '11': 'stable' } }
      })

      const flow = useRoomUpgradeFlow({ roomId: '!r:s' })
      await flow.load()
      flow.targetVersion.value = '11'

      expect(flow.resolveTargetVersion()).toBe('11')
    })

    it('falls back to default version', async () => {
      mockGetRoomVersion.mockResolvedValueOnce('10')
      mockGetCapabilities.mockResolvedValueOnce({
        'm.room_versions': { default: '11', available: { '11': 'stable' } }
      })

      const flow = useRoomUpgradeFlow({ roomId: '!r:s' })
      await flow.load()

      expect(flow.resolveTargetVersion()).toBe('11')
    })

    it('falls back to newest newerVersion when no default', async () => {
      mockGetRoomVersion.mockResolvedValueOnce('9')
      mockGetCapabilities.mockResolvedValueOnce({
        'm.room_versions': { default: '', available: { '10': 'stable', '11': 'stable' } }
      })

      const flow = useRoomUpgradeFlow({ roomId: '!r:s' })
      await flow.load()

      expect(flow.resolveTargetVersion()).toBe('11')
    })

    it('returns null when no versions available', async () => {
      mockGetRoomVersion.mockResolvedValueOnce('10')
      mockGetCapabilities.mockResolvedValueOnce({})

      const flow = useRoomUpgradeFlow({ roomId: '!r:s' })
      await flow.load()

      expect(flow.resolveTargetVersion()).toBeNull()
    })
  })

  describe('upgrade', () => {
    it('returns null and shows feedback when roomId is null', async () => {
      const flow = useRoomUpgradeFlow({ roomId: null })
      const result = await flow.upgrade('11')

      expect(result).toBeNull()
      expect(mockShowFeedback).toHaveBeenCalledWith('room_advanced.room_upgrade.failed', 'error')
      expect(mockUpgradeRoom).not.toHaveBeenCalled()
    })

    it('returns null when no target version resolvable', async () => {
      mockGetRoomVersion.mockResolvedValueOnce('10')
      mockGetCapabilities.mockResolvedValueOnce({})

      const flow = useRoomUpgradeFlow({ roomId: '!r:s' })
      await flow.load()

      const result = await flow.upgrade()

      expect(result).toBeNull()
      expect(mockShowFeedback).toHaveBeenCalledWith('room_advanced.room_upgrade.failed', 'error')
      expect(mockUpgradeRoom).not.toHaveBeenCalled()
    })

    it('calls upgradeRoom with explicit version and returns replacement room id', async () => {
      mockUpgradeRoom.mockResolvedValueOnce('!new:s')

      const flow = useRoomUpgradeFlow({ roomId: '!r:s' })
      const result = await flow.upgrade('11')

      expect(result).toBe('!new:s')
      expect(mockUpgradeRoom).toHaveBeenCalledWith('!r:s', '11')
      expect(mockShowFeedback).toHaveBeenCalledWith('room_advanced.room_upgrade.success', 'success')
      expect(flow.upgrading.value).toBe(false)
    })

    it('falls back to resolved target version when not provided', async () => {
      mockGetRoomVersion.mockResolvedValueOnce('10')
      mockGetCapabilities.mockResolvedValueOnce({
        'm.room_versions': { default: '11', available: { '11': 'stable' } }
      })
      mockUpgradeRoom.mockResolvedValueOnce('!new:s')

      const flow = useRoomUpgradeFlow({ roomId: '!r:s' })
      await flow.load()
      const result = await flow.upgrade()

      expect(result).toBe('!new:s')
      expect(mockUpgradeRoom).toHaveBeenCalledWith('!r:s', '11')
    })

    it('shows error feedback when upgrade throws', async () => {
      mockUpgradeRoom.mockRejectedValueOnce(new Error('upgrade failed'))

      const flow = useRoomUpgradeFlow({ roomId: '!r:s' })
      const result = await flow.upgrade('11')

      expect(result).toBeNull()
      expect(mockShowFeedback).toHaveBeenCalledWith('room_advanced.room_upgrade.failed', 'error')
      expect(flow.upgrading.value).toBe(false)
      expect(flow.errorMessage.value).toBe('room_advanced.room_upgrade.failed')
    })

    it('sets upgrading true during operation and clears on finish', async () => {
      let resolveUpgrade: (v: string) => void = () => {}
      mockUpgradeRoom.mockImplementationOnce(() => new Promise<string>((resolve) => (resolveUpgrade = resolve)))

      const flow = useRoomUpgradeFlow({ roomId: '!r:s' })
      const promise = flow.upgrade('11')

      expect(flow.upgrading.value).toBe(true)

      resolveUpgrade('!new:s')
      await promise

      expect(flow.upgrading.value).toBe(false)
    })
  })
})
