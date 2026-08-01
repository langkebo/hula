import { beforeEach, describe, expect, it } from 'vitest'
import {
  clearCurrentUserState,
  getCurrentUserInfo,
  patchCurrentUserInfoFields,
  setCurrentUserInfo
} from '@/common/currentUserState'
import { SexEnum } from '@/enums'
import type { UserInfoType } from '@/services/types'

function makeUserInfo(overrides: Partial<UserInfoType> = {}): UserInfoType {
  return {
    uid: 'test-uid',
    account: 'test-account',
    email: 'test@example.com',
    avatar: 'test-avatar',
    name: 'test-name',
    modifyNameChance: 3,
    sex: SexEnum.MAN,
    userStateId: 'state-1',
    avatarUpdateTime: 0,
    client: 'web',
    resume: '',
    ...overrides
  }
}

describe('currentUserState', () => {
  beforeEach(() => {
    clearCurrentUserState()
  })

  describe('getCurrentUserInfo / setCurrentUserInfo', () => {
    it('初始值为 undefined', () => {
      expect(getCurrentUserInfo()).toBeUndefined()
    })

    it('setCurrentUserInfo 设置并返回用户信息', () => {
      const info = makeUserInfo()
      expect(setCurrentUserInfo(info)).toEqual(info)
      expect(getCurrentUserInfo()).toEqual(info)
    })

    it('setCurrentUserInfo(undefined) 清除用户信息', () => {
      setCurrentUserInfo(makeUserInfo())
      expect(setCurrentUserInfo(undefined)).toBeUndefined()
      expect(getCurrentUserInfo()).toBeUndefined()
    })

    it('多次设置覆盖前值', () => {
      const info1 = makeUserInfo({ uid: '1', name: 'user1' })
      const info2 = makeUserInfo({ uid: '2', name: 'user2' })

      setCurrentUserInfo(info1)
      expect(getCurrentUserInfo()).toEqual(info1)

      setCurrentUserInfo(info2)
      expect(getCurrentUserInfo()).toEqual(info2)
    })
  })

  describe('patchCurrentUserInfoFields', () => {
    it('当未设置用户信息时返回 undefined', () => {
      expect(patchCurrentUserInfoFields({ name: 'new' })).toBeUndefined()
    })

    it('更新 name 字段', () => {
      setCurrentUserInfo(makeUserInfo({ name: 'old' }))
      const patched = patchCurrentUserInfoFields({ name: 'new-name' })
      expect(patched?.name).toBe('new-name')
    })

    it('更新 avatar 字段', () => {
      setCurrentUserInfo(makeUserInfo({ avatar: 'old-avatar' }))
      const patched = patchCurrentUserInfoFields({ avatar: 'new-avatar' })
      expect(patched?.avatar).toBe('new-avatar')
    })

    it('更新 activeStatus 字段', () => {
      setCurrentUserInfo(makeUserInfo())
      const patched = patchCurrentUserInfoFields({ activeStatus: 1 })
      expect(patched?.activeStatus).toBe(1)
    })

    it('更新 lastOptTime 字段', () => {
      setCurrentUserInfo(makeUserInfo())
      const patched = patchCurrentUserInfoFields({ lastOptTime: 1700000000000 })
      expect(patched?.lastOptTime).toBe(1700000000000)
    })

    it('未提供的字段保持不变', () => {
      const info = makeUserInfo({ name: 'keep-name', avatar: 'keep-avatar' })
      setCurrentUserInfo(info)
      patchCurrentUserInfoFields({ activeStatus: 1 })

      const current = getCurrentUserInfo()
      expect(current?.name).toBe('keep-name')
      expect(current?.avatar).toBe('keep-avatar')
      expect(current?.activeStatus).toBe(1)
    })

    it('同时更新多个字段', () => {
      setCurrentUserInfo(makeUserInfo({ name: 'old', avatar: 'old-avatar' }))
      const patched = patchCurrentUserInfoFields({
        name: 'new',
        avatar: 'new-avatar',
        activeStatus: 2,
        lastOptTime: 1700000000001
      })
      expect(patched?.name).toBe('new')
      expect(patched?.avatar).toBe('new-avatar')
      expect(patched?.activeStatus).toBe(2)
      expect(patched?.lastOptTime).toBe(1700000000001)
    })
  })

  describe('clearCurrentUserState', () => {
    it('清除已设置的用户信息', () => {
      setCurrentUserInfo(makeUserInfo())
      clearCurrentUserState()
      expect(getCurrentUserInfo()).toBeUndefined()
    })

    it('未设置用户信息时调用不抛错', () => {
      expect(() => clearCurrentUserState()).not.toThrow()
      expect(getCurrentUserInfo()).toBeUndefined()
    })

    it('多次调用不抛错', () => {
      setCurrentUserInfo(makeUserInfo())
      clearCurrentUserState()
      clearCurrentUserState()
      expect(getCurrentUserInfo()).toBeUndefined()
    })
  })
})
