import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useUserAvatar } from '../useUserAvatar'

const userState = vi.hoisted(() => ({
  userInfo: { uid: '@me:server', avatar: '007' } as { uid: string; avatar?: string } | null
}))

const groupUsers = vi.hoisted(() => new Map<string, { avatar?: string }>())

vi.mock('@/stores/domains/user/user', () => ({
  useUserStore: () => ({
    get userInfo() {
      return userState.userInfo
    }
  })
}))
vi.mock('@/stores/domains/chat/group', () => ({
  useGroupStore: () => ({ getUserInfo: (uid: string) => groupUsers.get(uid) })
}))

describe('useUserAvatar', () => {
  const { resolveAvatarUrl } = useUserAvatar()

  beforeEach(() => {
    userState.userInfo = { uid: '@me:server', avatar: '007' }
    groupUsers.clear()
  })

  it('自己的 uid 命中当前账号头像', () => {
    expect(resolveAvatarUrl('@me:server')).toBe('/avatar/007.webp')
  })

  it('他人的 uid 命中用户资料缓存中的头像', () => {
    groupUsers.set('@alice:server', { avatar: '012' })
    expect(resolveAvatarUrl('@alice:server')).toBe('/avatar/012.webp')
  })

  it('查无此人时回落到默认头像', () => {
    expect(resolveAvatarUrl('@unknown:server')).toBe('/logo.png')
  })

  it('未登录（无 userInfo）时也回落到默认头像', () => {
    userState.userInfo = null
    expect(resolveAvatarUrl('@me:server')).toBe('/logo.png')
  })
})
