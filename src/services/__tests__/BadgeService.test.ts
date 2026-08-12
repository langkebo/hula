import { beforeEach, describe, expect, it, vi } from 'vitest'
import { badgeService } from '@/services/BadgeService'

const mockGetAccountData = vi.fn()
const mockSetAccountData = vi.fn()

vi.mock('@/services/matrix/user/MatrixAccountService', () => ({
  matrixAccountService: {
    getAccountData: (...args: unknown[]) => mockGetAccountData(...args),
    setAccountData: (...args: unknown[]) => mockSetAccountData(...args)
  }
}))

vi.mock('@/stores/domains/chat/badge', () => ({
  buildBadgeCatalog: (ids: string[]) =>
    ids.map((id) => ({
      id,
      img: `/badge/${id}.png`,
      describe: `徽章 ${id}`
    }))
}))

const ACCOUNT_DATA_TYPE = 'io.hula.badge.preference'

describe('BadgeService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getBadgeList', () => {
    it('returns badges with obtain=YES and correct wearing flag', async () => {
      mockGetAccountData.mockResolvedValue({
        ownedIds: ['1', '2'],
        wearingItemId: '1'
      })

      const badges = await badgeService.getBadgeList()

      expect(badges).toHaveLength(2)
      expect(badges[0]).toMatchObject({ id: '1', obtain: 1, wearing: 1 })
      expect(badges[1]).toMatchObject({ id: '2', obtain: 1, wearing: 0 })
      expect(mockGetAccountData).toHaveBeenCalledWith(ACCOUNT_DATA_TYPE)
    })

    it('handles null account data gracefully', async () => {
      mockGetAccountData.mockResolvedValue(null)

      const badges = await badgeService.getBadgeList()

      expect(badges).toEqual([])
    })

    it('handles missing ownedIds gracefully', async () => {
      mockGetAccountData.mockResolvedValue({ wearingItemId: '1' })

      const badges = await badgeService.getBadgeList()

      expect(badges).toEqual([])
    })

    it('returns empty array on error', async () => {
      mockGetAccountData.mockRejectedValue(new Error('Network error'))

      const badges = await badgeService.getBadgeList()

      expect(badges).toEqual([])
    })
  })

  describe('setUserBadge', () => {
    it('sets the wearing badge preserving ownedIds', async () => {
      mockGetAccountData.mockResolvedValue({
        ownedIds: ['1', '2', '3'],
        wearingItemId: '1'
      })

      await badgeService.setUserBadge('3')

      expect(mockSetAccountData).toHaveBeenCalledWith(ACCOUNT_DATA_TYPE, {
        wearingItemId: '3',
        ownedIds: ['1', '2', '3']
      })
    })

    it('works when no badge was previously worn', async () => {
      mockGetAccountData.mockResolvedValue({ ownedIds: ['1'], wearingItemId: undefined })

      await badgeService.setUserBadge('1')

      expect(mockSetAccountData).toHaveBeenCalledWith(ACCOUNT_DATA_TYPE, {
        wearingItemId: '1',
        ownedIds: ['1']
      })
    })

    it('propagates getAccountData errors', async () => {
      const err = new Error('Client not initialized')
      mockGetAccountData.mockRejectedValue(err)

      await expect(badgeService.setUserBadge('1')).rejects.toThrow('Client not initialized')
    })

    it('propagates setAccountData errors', async () => {
      mockGetAccountData.mockResolvedValue({ ownedIds: ['1'], wearingItemId: undefined })
      mockSetAccountData.mockRejectedValue(new Error('Write failed'))

      await expect(badgeService.setUserBadge('1')).rejects.toThrow('Write failed')
    })
  })
})
