import { beforeEach, describe, expect, it } from 'vitest'
import { getMatrixSessionSnapshot, patchMatrixSessionSnapshot } from '../matrixSessionState'

describe('matrixSessionState', () => {
  beforeEach(() => {
    // 重置模块级状态
    patchMatrixSessionSnapshot({ userId: null, deviceId: null, accessToken: null, homeserverUrl: null })
  })

  describe('getMatrixSessionSnapshot', () => {
    it('should return all-null snapshot when nothing set', () => {
      expect(getMatrixSessionSnapshot()).toEqual({
        userId: null,
        deviceId: null,
        accessToken: null,
        homeserverUrl: null
      })
    })
  })

  describe('patchMatrixSessionSnapshot', () => {
    it('should update a single field and leave others unchanged', () => {
      patchMatrixSessionSnapshot({ userId: '@alice:server.com' })

      const snapshot = getMatrixSessionSnapshot()
      expect(snapshot.userId).toBe('@alice:server.com')
      expect(snapshot.deviceId).toBeNull()
      expect(snapshot.accessToken).toBeNull()
      expect(snapshot.homeserverUrl).toBeNull()
    })

    it('should update all fields at once', () => {
      const snapshot = patchMatrixSessionSnapshot({
        userId: '@bob:server.com',
        deviceId: 'DEV123',
        accessToken: 'syt_token',
        homeserverUrl: 'https://hs.example.com'
      })

      expect(snapshot).toEqual({
        userId: '@bob:server.com',
        deviceId: 'DEV123',
        accessToken: 'syt_token',
        homeserverUrl: 'https://hs.example.com'
      })
    })

    it('should clear a field when patched to null', () => {
      patchMatrixSessionSnapshot({ userId: '@carol:server.com' })
      const snapshot = patchMatrixSessionSnapshot({ userId: null })

      expect(snapshot.userId).toBeNull()
    })

    it('should return the full snapshot after patching', () => {
      const returned = patchMatrixSessionSnapshot({ accessToken: 'tok' })

      expect(returned.accessToken).toBe('tok')
      expect(returned.userId).toBeNull()
    })

    it('should return unchanged snapshot when patch is empty object', () => {
      patchMatrixSessionSnapshot({ userId: '@dave:server.com' })
      const snapshot = patchMatrixSessionSnapshot({})

      expect(snapshot.userId).toBe('@dave:server.com')
    })
  })
})
