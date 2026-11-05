import { beforeEach, describe, expect, it } from 'vitest'
import {
  bumpFriendsGeneration,
  clearAllFriendReadErrors,
  clearFriendReadError,
  clearFriendsLoadError,
  getFriendReadError,
  getFriendsGeneration,
  getFriendsLoadError,
  setFriendReadError,
  setFriendsLoadError
} from '../friendEvents'

/**
 * 好友域的「读失败信号」与「数据代际」。
 *
 * 这两样东西都**故意不放在事件总线里**：`friendEventBus.clear()`
 * （登出 / 服务 stop 时调用）会把监听器清空，若信号走事件，
 * 登出再登入后内部订阅就消失了 —— 缓存永不失效、错误态永不更新。
 *
 * 所以它们必须是模块级状态 + 纯函数。本测试锁的就是这份契约。
 */
describe('friendEvents —— 读失败信号（按通道隔离）', () => {
  beforeEach(() => {
    clearAllFriendReadErrors()
  })

  it('三个通道互不干扰（friends / requests / search）', () => {
    setFriendReadError('friends', new Error('list down'))
    setFriendReadError('requests', new Error('requests down'))
    setFriendReadError('search', new Error('search down'))

    expect(String(getFriendReadError('friends'))).toContain('list down')
    expect(String(getFriendReadError('requests'))).toContain('requests down')
    expect(String(getFriendReadError('search'))).toContain('search down')
  })

  it('未设置过的通道返回 null（调用方据此判「上次成功」）', () => {
    expect(getFriendReadError('friends')).toBeNull()
    expect(getFriendReadError('requests')).toBeNull()
    expect(getFriendReadError('search')).toBeNull()
  })

  it('单通道清空不影响其它通道', () => {
    setFriendReadError('friends', new Error('a'))
    setFriendReadError('search', new Error('b'))

    clearFriendReadError('friends')

    expect(getFriendReadError('friends')).toBeNull()
    expect(String(getFriendReadError('search'))).toContain('b')
  })

  it('clearAllFriendReadErrors() 清空全部（登出 / 账号切换）', () => {
    setFriendReadError('friends', new Error('a'))
    setFriendReadError('requests', new Error('b'))
    setFriendReadError('search', new Error('c'))

    clearAllFriendReadErrors()

    expect(getFriendReadError('friends')).toBeNull()
    expect(getFriendReadError('requests')).toBeNull()
    expect(getFriendReadError('search')).toBeNull()
  })

  it('get/set/clearFriendsLoadError 是 friends 通道的薄包装（旧调用方口径不变）', () => {
    setFriendsLoadError(new Error('legacy api'))
    expect(getFriendsLoadError()).toBeInstanceOf(Error)
    // 必须与通用通道读到同一个值，否则新旧两套 API 会各说各话
    expect(getFriendsLoadError()).toBe(getFriendReadError('friends'))

    clearFriendsLoadError()
    expect(getFriendsLoadError()).toBeNull()
    expect(getFriendReadError('friends')).toBeNull()
  })

  it('非 Error 取值也能记录（服务层可能抛字符串/对象）', () => {
    setFriendReadError('requests', 'plain string failure')
    expect(getFriendReadError('requests')).toBe('plain string failure')
  })
})

describe('friendEvents —— 数据代际', () => {
  it('每 bump 一次递增 1，且单调不回退', () => {
    const start = getFriendsGeneration()

    bumpFriendsGeneration()
    expect(getFriendsGeneration()).toBe(start + 1)

    bumpFriendsGeneration()
    expect(getFriendsGeneration()).toBe(start + 2)
  })

  it('代际是模块级状态，不受 clearAllFriendReadErrors() 影响', () => {
    bumpFriendsGeneration()
    const before = getFriendsGeneration()

    clearAllFriendReadErrors()

    // 缓存失效靠代际，不能因为「清了错误态」就把缓存也判成有效
    expect(getFriendsGeneration()).toBe(before)
  })
})
