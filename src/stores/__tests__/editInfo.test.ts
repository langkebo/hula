import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useEditInfoStore } from '../editInfo'
import { IsYesEnum } from '@/enums'

interface BadgeType {
  id: string
  img: string
  describe: string
  obtain: IsYesEnum
  wearing: IsYesEnum
}

interface UserInfoType {
  uid: string
  name: string
  avatar?: string
  modifyNameChance?: number
  wearingItemId?: string
}

describe('useEditInfoStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  describe('initial state', () => {
    it('should have correct initial state', () => {
      const store = useEditInfoStore()

      expect(store.show).toBe(false)
      expect(store.content).toEqual({})
      expect(store.badgeList).toEqual([])
      expect(store.loading).toBe(false)
    })

    it('should have null currentBadge initially', () => {
      const store = useEditInfoStore()

      expect(store.currentBadge).toBeUndefined()
    })

    it('should have false hasBadge initially', () => {
      const store = useEditInfoStore()

      expect(store.hasBadge).toBe(false)
    })
  })

  describe('openEditInfo', () => {
    it('should set show to true', () => {
      const store = useEditInfoStore()

      store.openEditInfo()

      expect(store.show).toBe(true)
    })

    it('should set content with provided data', () => {
      const store = useEditInfoStore()
      const userData: Partial<UserInfoType> = {
        uid: 'user123',
        name: 'Test User',
        avatar: 'avatar.png'
      }

      store.openEditInfo(userData)

      expect(store.content).toEqual(userData)
    })

    it('should set empty content when no data provided', () => {
      const store = useEditInfoStore()

      store.openEditInfo()

      expect(store.content).toEqual({})
    })

    it('should create a copy of provided data', () => {
      const store = useEditInfoStore()
      const userData: Partial<UserInfoType> = {
        uid: 'user123',
        name: 'Test User'
      }

      store.openEditInfo(userData)
      userData.name = 'Modified'

      expect(store.content.name).toBe('Test User')
    })
  })

  describe('closeEditInfo', () => {
    it('should set show to false', () => {
      const store = useEditInfoStore()
      store.openEditInfo()

      store.closeEditInfo()

      expect(store.show).toBe(false)
    })
  })

  describe('toggleEditInfo', () => {
    it('should open when closed', () => {
      const store = useEditInfoStore()

      store.toggleEditInfo()

      expect(store.show).toBe(true)
    })

    it('should close when open', () => {
      const store = useEditInfoStore()
      store.openEditInfo()

      store.toggleEditInfo()

      expect(store.show).toBe(false)
    })

    it('should pass data when opening', () => {
      const store = useEditInfoStore()
      const userData: Partial<UserInfoType> = { uid: 'user123' }

      store.toggleEditInfo(userData)

      expect(store.content).toEqual(userData)
    })
  })

  describe('updateContent', () => {
    it('should merge new data with existing content', () => {
      const store = useEditInfoStore()
      store.openEditInfo({ uid: 'user123', name: 'Test' })

      store.updateContent({ avatar: 'new-avatar.png' })

      expect(store.content).toEqual({
        uid: 'user123',
        name: 'Test',
        avatar: 'new-avatar.png'
      })
    })

    it('should overwrite existing fields', () => {
      const store = useEditInfoStore()
      store.openEditInfo({ name: 'Old Name' })

      store.updateContent({ name: 'New Name' })

      expect(store.content.name).toBe('New Name')
    })
  })

  describe('setContent', () => {
    it('should replace content entirely', () => {
      const store = useEditInfoStore()
      store.openEditInfo({ uid: 'user123', name: 'Test' })

      store.setContent({ avatar: 'avatar.png' })

      expect(store.content).toEqual({ avatar: 'avatar.png' })
      expect(store.content.uid).toBeUndefined()
    })
  })

  describe('clearContent', () => {
    it('should clear content', () => {
      const store = useEditInfoStore()
      store.openEditInfo({ uid: 'user123' })

      store.clearContent()

      expect(store.content).toEqual({})
    })
  })

  describe('setBadgeList', () => {
    it('should set badge list', () => {
      const store = useEditInfoStore()
      const badges: BadgeType[] = [
        {
          id: 'badge1',
          img: 'badge1.png',
          describe: 'Badge 1',
          obtain: IsYesEnum.YES,
          wearing: IsYesEnum.YES
        }
      ]

      store.setBadgeList(badges)

      expect(store.badgeList).toEqual(badges)
    })

    it('should create copies of badges', () => {
      const store = useEditInfoStore()
      const badges: BadgeType[] = [
        {
          id: 'badge1',
          img: 'badge1.png',
          describe: 'Badge 1',
          obtain: IsYesEnum.YES,
          wearing: IsYesEnum.NO
        }
      ]

      store.setBadgeList(badges)
      badges[0].describe = 'Modified'

      expect(store.badgeList[0].describe).toBe('Badge 1')
    })
  })

  describe('wearBadge', () => {
    it('should set wearing to YES for specified badge', () => {
      const store = useEditInfoStore()
      store.setBadgeList([
        {
          id: 'badge1',
          img: 'badge1.png',
          describe: 'Badge 1',
          obtain: IsYesEnum.YES,
          wearing: IsYesEnum.NO
        },
        {
          id: 'badge2',
          img: 'badge2.png',
          describe: 'Badge 2',
          obtain: IsYesEnum.YES,
          wearing: IsYesEnum.YES
        }
      ])

      store.wearBadge('badge1')

      expect(store.badgeList[0].wearing).toBe(IsYesEnum.YES)
      expect(store.badgeList[1].wearing).toBe(IsYesEnum.NO)
    })

    it('should update currentBadge computed', () => {
      const store = useEditInfoStore()
      store.setBadgeList([
        {
          id: 'badge1',
          img: 'badge1.png',
          describe: 'Badge 1',
          obtain: IsYesEnum.YES,
          wearing: IsYesEnum.NO
        }
      ])

      store.wearBadge('badge1')

      expect(store.currentBadge?.id).toBe('badge1')
    })
  })

  describe('unwearBadge', () => {
    it('should set wearing to NO for all badges', () => {
      const store = useEditInfoStore()
      store.setBadgeList([
        {
          id: 'badge1',
          img: 'badge1.png',
          describe: 'Badge 1',
          obtain: IsYesEnum.YES,
          wearing: IsYesEnum.YES
        }
      ])

      store.unwearBadge()

      expect(store.badgeList[0].wearing).toBe(IsYesEnum.NO)
      expect(store.currentBadge).toBeUndefined()
    })
  })

  describe('updateBadge', () => {
    it('should update specific badge', () => {
      const store = useEditInfoStore()
      store.setBadgeList([
        {
          id: 'badge1',
          img: 'badge1.png',
          describe: 'Badge 1',
          obtain: IsYesEnum.YES,
          wearing: IsYesEnum.NO
        }
      ])

      store.updateBadge('badge1', { describe: 'Updated Badge' })

      expect(store.badgeList[0].describe).toBe('Updated Badge')
    })

    it('should not affect other badges', () => {
      const store = useEditInfoStore()
      store.setBadgeList([
        {
          id: 'badge1',
          img: 'badge1.png',
          describe: 'Badge 1',
          obtain: IsYesEnum.YES,
          wearing: IsYesEnum.NO
        },
        {
          id: 'badge2',
          img: 'badge2.png',
          describe: 'Badge 2',
          obtain: IsYesEnum.YES,
          wearing: IsYesEnum.NO
        }
      ])

      store.updateBadge('badge1', { describe: 'Updated' })

      expect(store.badgeList[1].describe).toBe('Badge 2')
    })
  })

  describe('setLoading', () => {
    it('should set loading state', () => {
      const store = useEditInfoStore()

      store.setLoading(true)

      expect(store.loading).toBe(true)

      store.setLoading(false)

      expect(store.loading).toBe(false)
    })
  })

  describe('reset', () => {
    it('should reset all state to initial values', () => {
      const store = useEditInfoStore()
      store.openEditInfo({ uid: 'user123' })
      store.setBadgeList([
        {
          id: 'badge1',
          img: 'badge1.png',
          describe: 'Badge 1',
          obtain: IsYesEnum.YES,
          wearing: IsYesEnum.YES
        }
      ])
      store.setLoading(true)

      store.reset()

      expect(store.show).toBe(false)
      expect(store.content).toEqual({})
      expect(store.badgeList).toEqual([])
      expect(store.loading).toBe(false)
    })
  })

  describe('computed properties', () => {
    describe('currentBadge', () => {
      it('should return badge that is obtained and wearing', () => {
        const store = useEditInfoStore()
        store.setBadgeList([
          {
            id: 'badge1',
            img: 'badge1.png',
            describe: 'Badge 1',
            obtain: IsYesEnum.YES,
            wearing: IsYesEnum.YES
          },
          {
            id: 'badge2',
            img: 'badge2.png',
            describe: 'Badge 2',
            obtain: IsYesEnum.YES,
            wearing: IsYesEnum.NO
          }
        ])

        expect(store.currentBadge?.id).toBe('badge1')
      })

      it('should return undefined when no badge is wearing', () => {
        const store = useEditInfoStore()
        store.setBadgeList([
          {
            id: 'badge1',
            img: 'badge1.png',
            describe: 'Badge 1',
            obtain: IsYesEnum.YES,
            wearing: IsYesEnum.NO
          }
        ])

        expect(store.currentBadge).toBeUndefined()
      })

      it('should return undefined when badge is not obtained', () => {
        const store = useEditInfoStore()
        store.setBadgeList([
          {
            id: 'badge1',
            img: 'badge1.png',
            describe: 'Badge 1',
            obtain: IsYesEnum.NO,
            wearing: IsYesEnum.YES
          }
        ])

        expect(store.currentBadge).toBeUndefined()
      })
    })

    describe('hasBadge', () => {
      it('should return true when badge list is not empty', () => {
        const store = useEditInfoStore()
        store.setBadgeList([
          {
            id: 'badge1',
            img: 'badge1.png',
            describe: 'Badge 1',
            obtain: IsYesEnum.NO,
            wearing: IsYesEnum.NO
          }
        ])

        expect(store.hasBadge).toBe(true)
      })

      it('should return false when badge list is empty', () => {
        const store = useEditInfoStore()

        expect(store.hasBadge).toBe(false)
      })
    })
  })
})
