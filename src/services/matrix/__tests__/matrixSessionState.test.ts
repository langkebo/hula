import { beforeEach, describe, expect, it } from 'vitest'
import { getMatrixSessionSnapshot, patchMatrixSessionSnapshot } from '../matrixSessionState'

/**
 * AR-07b / B1 契约：运行时会话快照**不得携带 access token**。
 *
 * token 的唯一读入口是 `matrixClientAccessor.getMatrixAccessToken()`（直读 SDK client）。
 * 快照里曾经有一份 Vue ref 副本，但 `MatrixTokenManager.refresh()` 不回写它 ⇒ 刷新后陈旧。
 * 这里的「快照键集合」断言就是防它回归的单元级守卫。
 */
describe('matrixSessionState', () => {
  beforeEach(() => {
    // 重置模块级状态
    patchMatrixSessionSnapshot({ userId: null, deviceId: null, homeserverUrl: null })
  })

  describe('getMatrixSessionSnapshot', () => {
    it('should return all-null snapshot when nothing set', () => {
      expect(getMatrixSessionSnapshot()).toEqual({
        userId: null,
        deviceId: null,
        homeserverUrl: null
      })
    })

    it('does not expose an access token field (AR-07b: no token copy in snapshot)', () => {
      const snapshot = getMatrixSessionSnapshot()

      expect(Object.keys(snapshot).sort()).toEqual(['deviceId', 'homeserverUrl', 'userId'])
      expect('accessToken' in snapshot).toBe(false)
    })
  })

  describe('patchMatrixSessionSnapshot', () => {
    it('should update a single field and leave others unchanged', () => {
      patchMatrixSessionSnapshot({ userId: '@alice:server.com' })

      const snapshot = getMatrixSessionSnapshot()
      expect(snapshot.userId).toBe('@alice:server.com')
      expect(snapshot.deviceId).toBeNull()
      expect(snapshot.homeserverUrl).toBeNull()
    })

    it('should update all fields at once', () => {
      const snapshot = patchMatrixSessionSnapshot({
        userId: '@bob:server.com',
        deviceId: 'DEV123',
        homeserverUrl: 'https://hs.example.com'
      })

      expect(snapshot).toEqual({
        userId: '@bob:server.com',
        deviceId: 'DEV123',
        homeserverUrl: 'https://hs.example.com'
      })
    })

    it('should clear a field when patched to null', () => {
      patchMatrixSessionSnapshot({ userId: '@carol:server.com' })
      const snapshot = patchMatrixSessionSnapshot({ userId: null })

      expect(snapshot.userId).toBeNull()
    })

    it('should return the full snapshot after patching', () => {
      const returned = patchMatrixSessionSnapshot({ deviceId: 'DEV999' })

      expect(returned.deviceId).toBe('DEV999')
      expect(returned.userId).toBeNull()
    })

    it('should return unchanged snapshot when patch is empty object', () => {
      patchMatrixSessionSnapshot({ userId: '@dave:server.com' })
      const snapshot = patchMatrixSessionSnapshot({})

      expect(snapshot.userId).toBe('@dave:server.com')
    })

    it('ignores an accessToken key at runtime (类型已禁止，运行时也不得落库)', () => {
      // 绕过类型以模拟「旧调用点漏改」：必须被忽略，而不是悄悄又存一份 token
      const snapshot = patchMatrixSessionSnapshot({ accessToken: 'syt_leaked' } as never)

      expect('accessToken' in snapshot).toBe(false)
      expect(JSON.stringify(snapshot)).not.toContain('syt_leaked')
    })
  })
})
