import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockGetAccountData } = vi.hoisted(() => ({
  mockGetAccountData: vi.fn()
}))

vi.mock('@/services/matrix/user/MatrixAccountService', () => ({
  matrixAccountService: {
    getAccountData: mockGetAccountData
  }
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key
  })
}))

import { useFavorites } from '../useFavorites'

const ROOM_A = '!roomA:server'
const ROOM_B = '!roomB:server'

const makeFavorite = (eventId: string, ts: number, body = 'hello') => ({
  eventId,
  sender: '@alice:server',
  body,
  timestamp: ts,
  msgtype: 'm.text'
})

describe('useFavorites.load', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('reads favorites from server account-data and filters by current roomId', async () => {
    mockGetAccountData.mockResolvedValue({
      [ROOM_A]: [makeFavorite('$a1', 100), makeFavorite('$a2', 200)],
      [ROOM_B]: [makeFavorite('$b1', 300)]
    })

    const { favorites, load } = useFavorites({ roomId: () => ROOM_A })
    await load()

    expect(favorites.value).toHaveLength(2)
    expect(favorites.value.map((f) => f.eventId)).toEqual(['$a1', '$a2'])
  })

  it('returns empty list when the account-data event does not exist', async () => {
    mockGetAccountData.mockResolvedValue(null)

    const { favorites, load } = useFavorites({ roomId: () => ROOM_A })
    await load()

    expect(favorites.value).toEqual([])
    expect(mockGetAccountData).toHaveBeenCalledWith('im.hula.favorite_messages')
  })

  it('returns empty list when current room has no favorites yet', async () => {
    mockGetAccountData.mockResolvedValue({
      [ROOM_B]: [makeFavorite('$b1', 300)]
    })

    const { favorites, load } = useFavorites({ roomId: () => ROOM_A })
    await load()

    expect(favorites.value).toEqual([])
  })

  it('does not call the server when roomId is null', async () => {
    const { favorites, load } = useFavorites({ roomId: () => null })
    await load()

    expect(favorites.value).toEqual([])
    expect(mockGetAccountData).not.toHaveBeenCalled()
  })

  it('drops malformed entries returned by the server', async () => {
    mockGetAccountData.mockResolvedValue({
      [ROOM_A]: [
        makeFavorite('$a1', 100),
        { sender: '@x:server', body: 'no eventId' } as never,
        { eventId: '$a2', sender: '@y:server', body: 'no ts', msgtype: 'm.text' } as never
      ]
    })

    const { favorites, load } = useFavorites({ roomId: () => ROOM_A })
    await load()

    expect(favorites.value).toEqual([makeFavorite('$a1', 100)])
  })

  it('sets errorMessage and empty list when account-data fetch rejects', async () => {
    mockGetAccountData.mockRejectedValue(new Error('network down'))

    const { favorites, errorMessage, load } = useFavorites({ roomId: () => ROOM_A })
    await load()

    expect(favorites.value).toEqual([])
    expect(errorMessage.value).toBe('home.chat_sidebar.favorites.load_failed')
  })
})
