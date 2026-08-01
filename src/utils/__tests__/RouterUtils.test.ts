import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { pushMock, setAddFriendTargetMock } = vi.hoisted(() => ({
  pushMock: vi.fn(),
  setAddFriendTargetMock: vi.fn()
}))

vi.mock('../../router', () => ({
  default: {
    push: pushMock
  }
}))

vi.mock('@/stores/domains/widget/global', () => ({
  useGlobalStore: () => ({
    setAddFriendTarget: setAddFriendTargetMock
  })
}))

import { toFriendInfoPage } from '../RouterUtils'

describe('RouterUtils', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    pushMock.mockReset()
    setAddFriendTargetMock.mockReset()
  })

  describe('toFriendInfoPage', () => {
    it('sets add friend target and navigates to friend info page', () => {
      toFriendInfoPage('@alice:matrix.test')

      expect(setAddFriendTargetMock).toHaveBeenCalledWith('@alice:matrix.test')
      expect(pushMock).toHaveBeenCalledWith('/mobile/mobileFriends/friendInfo/@alice:matrix.test')
    })

    it('handles uid with special characters', () => {
      const uid = '@bob:server.example.com'
      toFriendInfoPage(uid)

      expect(setAddFriendTargetMock).toHaveBeenCalledWith(uid)
      expect(pushMock).toHaveBeenCalledWith(`/mobile/mobileFriends/friendInfo/${uid}`)
    })

    it('only calls each function once per invocation', () => {
      toFriendInfoPage('@single:matrix.test')

      expect(setAddFriendTargetMock).toHaveBeenCalledTimes(1)
      expect(pushMock).toHaveBeenCalledTimes(1)
    })
  })
})
